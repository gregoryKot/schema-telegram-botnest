// Сохранение концептуализации с версией строки и частичными связями
// (docs/open/therapy.md: «"Графические карты" (#963): запись холста в поля не
// упорядочена с полным сохранением», «Предельная концептуализация упрётся в
// потолок тела запроса»). Фейк хранит строку как Postgres: updatedAt растёт
// на каждой записи, поля шифруются в «БД» — проверка идёт связкой «сохранил
// патч → прочитал GET», а не «вызвали upsert».
import { BadRequestException, ConflictException } from '@nestjs/common';
import { saveConceptVersioned, patchLinks } from './concept-save';
import { appendToConcept } from './concept-append';
import { decryptConceptFields } from './concept-store';

const KEY = { therapistId: 1n, clientId: 2n };

function makePrisma() {
  const db: { row: any; levels: unknown[]; at: number } = {
    row: null,
    levels: [],
    at: Date.parse('2026-11-08T10:00:00.000Z'),
  };
  const table = {
    findUnique: jest.fn(async () => (db.row ? { ...db.row } : null)),
    upsert: jest.fn(async ({ create, update }: any) => {
      const updatedAt = new Date((db.at += 1000));
      db.row = db.row
        ? { ...db.row, ...update, updatedAt }
        : { id: 1, ...create, updatedAt };
      return { ...db.row };
    }),
  };
  const prisma: any = {
    clientConceptualization: table,
    $transaction: jest.fn(async (fn: any, opts?: any) => {
      db.levels.push(opts?.isolationLevel);
      return fn(prisma);
    }),
  };
  return { prisma, db };
}

const link = (modeId: string, origin = '') => ({
  modeId,
  alias: '',
  schemaIds: [],
  needIds: [],
  origin,
  manifest: '',
  strategy: '',
});

describe('saveConceptVersioned — версия строки', () => {
  it('патч с верной версией пишется; прочитанное — с правкой, остальное нетронуто', async () => {
    const { prisma, db } = makePrisma();
    const first = await saveConceptVersioned(prisma, KEY, {
      baseVersion: null,
      goals: 'опора',
      triggers: 'уход',
      modeLinks: [link('vulnerable_child', 'истоки'), link('angry_child')],
    });
    const saved = await saveConceptVersioned(prisma, KEY, {
      baseVersion: first.updatedAt.toISOString(),
      goals: 'опора и границы',
      modeLinksPatch: {
        upsert: [link('vulnerable_child', 'истоки + правка'), link('detached')],
        remove: ['angry_child'],
      },
    });
    const read = decryptConceptFields(db.row);
    expect(read.goals).toBe('опора и границы');
    expect(read.triggers).toBe('уход');
    expect(read.modeLinks).toEqual([
      link('vulnerable_child', 'истоки + правка'),
      link('detached'),
    ]);
    expect(saved.modeLinks).toEqual(read.modeLinks);
    expect(db.levels.every((l) => l === 'Serializable')).toBe(true);
  });

  it('устаревшая версия — 409, строка не тронута', async () => {
    const { prisma, db } = makePrisma();
    const first = await saveConceptVersioned(prisma, KEY, { goals: 'а' });
    await saveConceptVersioned(prisma, KEY, {
      baseVersion: first.updatedAt.toISOString(),
      goals: 'б',
    });
    const before = { ...db.row };
    await expect(
      saveConceptVersioned(prisma, KEY, {
        baseVersion: first.updatedAt.toISOString(),
        goals: 'в',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(db.row).toEqual(before);
  });

  it('холст дописал между чтением и сохранением вкладки — 409, дописанное цело', async () => {
    const { prisma, db } = makePrisma();
    const first = await saveConceptVersioned(prisma, KEY, {
      modeIds: ['vulnerable_child'],
    });
    const relations = { assertHasClient: jest.fn(async () => undefined) };
    await appendToConcept({ prisma, relations: relations as never }, KEY, {
      modeIds: ['angry_child'],
    });
    await expect(
      saveConceptVersioned(prisma, KEY, {
        baseVersion: first.updatedAt.toISOString(),
        modeIds: ['vulnerable_child'],
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(decryptConceptFields(db.row).modeIds).toEqual([
      'vulnerable_child',
      'angry_child',
    ]);
  });

  it('baseVersion = null, а строка уже есть — 409; без baseVersion (старый бандл) — без проверки', async () => {
    const { prisma } = makePrisma();
    await saveConceptVersioned(prisma, KEY, { goals: 'а' });
    await expect(
      saveConceptVersioned(prisma, KEY, { baseVersion: null, goals: 'б' }),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      saveConceptVersioned(prisma, KEY, { goals: 'в' }),
    ).resolves.toMatchObject({ goals: 'в' });
  });

  it('патч схем ложится поверх сохранённых связей схем', async () => {
    const { prisma, db } = makePrisma();
    await saveConceptVersioned(prisma, KEY, {
      schemaLinks: [{ schemaId: 'abandonment', belief: 'бросят' }],
    });
    await saveConceptVersioned(prisma, KEY, {
      schemaLinksPatch: {
        upsert: [{ schemaId: 'failure', belief: 'не смогу' }],
      },
    });
    expect(decryptConceptFields(db.row).schemaLinks).toEqual([
      { schemaId: 'abandonment', belief: 'бросят' },
      { schemaId: 'failure', belief: 'не смогу' },
    ]);
  });
});

describe('patchLinks', () => {
  it('после патча связей больше потолка — 400', () => {
    const stored = Array.from({ length: 40 }, (_, i) => link(`m${i}`));
    expect(() =>
      patchLinks(stored, { upsert: [link('m40')] }, 'modeId', 40),
    ).toThrow(BadRequestException);
    expect(
      patchLinks(
        stored,
        { upsert: [link('m40')], remove: ['m0'] },
        'modeId',
        40,
      ),
    ).toHaveLength(40);
  });

  it('сохранённого нет или оно не массив — патч на пустом', () => {
    expect(patchLinks(null, { upsert: [link('a')] }, 'modeId', 40)).toEqual([
      link('a'),
    ]);
  });
});

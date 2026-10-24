// Аудит 2026-10, D-8: один DM в минуту без таблицы и колонки не отличал одну
// нечитаемую строку от 10 000. Проба считает масштаб по паре таблица.колонка.
// Ключ — ДО загрузки crypto.ts (иначе encrypt() no-op и проверять нечего).
process.env.ENCRYPTION_KEY = 'ab'.repeat(32);

import { createCipheriv, randomBytes } from 'crypto';
import type { PrismaService } from '../../prisma/prisma.service';
import { encrypt, encryptJson } from '../../utils/crypto';
import {
  SAMPLE_ROWS,
  describeTallies,
  encryptionReadableProbe,
} from './probe-encryption-readable';

/** Шифротекст нашего формата под ДРУГИМ ключом. */
function foreign(text: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', Buffer.alloc(32, 9), iv, {
    authTagLength: 16,
  });
  const enc = Buffer.concat([c.update(text, 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), enc]).toString('base64');
}

type Rows = Record<string, Array<Record<string, unknown>>>;

function fakePrisma(tables: Rows) {
  const findMany = jest.fn(async (name: string, args: { take?: number }) =>
    (tables[name] ?? []).slice(0, args.take),
  );
  const prisma = new Proxy(
    {},
    {
      get: (_t, name: string) => ({
        findMany: (args: { take?: number }) => findMany(name, args),
        updateMany: jest.fn(),
      }),
    },
  ) as unknown as PrismaService;
  return { prisma, findMany };
}

const TARGETS = [
  { name: 'note', fields: ['text', 'tags'] },
  { name: 'user', fields: ['mySchemaIds'] },
  { name: 'userSafePlace', fields: ['description'], pk: 'userId' },
];
const probe = (
  tables: Rows,
  env: NodeJS.ProcessEnv = { ENCRYPTION_KEY: 'k' },
) => encryptionReadableProbe(fakePrisma(tables).prisma, env, TARGETS);

describe('encryptionReadableProbe', () => {
  it('всё читается своим ключом → ok, со счётом проверенного', async () => {
    const res = await probe({
      note: [{ id: 1, text: encrypt('заметка'), tags: encrypt('a') }],
      user: [{ id: 1, mySchemaIds: encryptJson(['abandonment']) }],
    }).run();
    expect(res.ok).toBe(true);
    expect(res.detail).toBe(
      `все читаются: проверено значений 3 в 4 колонках (последние ${SAMPLE_ROWS} строк каждой таблицы)`,
    );
  });

  it('шифротекст чужого ключа → не ok; в detail таблица.колонка и счёт, без содержимого', async () => {
    const blob = foreign('СЕКРЕТНАЯ заметка');
    const res = await probe({
      note: [
        { id: 3, text: blob, tags: encrypt('ок') },
        { id: 2, text: foreign('другая'), tags: null },
        { id: 1, text: encrypt('читается'), tags: null },
      ],
      user: [{ id: 1, mySchemaIds: foreign('["x"]') }],
    }).run();
    expect(res.ok).toBe(false);
    expect(res.detail).toContain('note.text 2 из 3');
    expect(res.detail).toContain('user.mySchemaIds 1 из 1');
    expect(res.detail).toContain('3 знач.');
    expect(res.detail).not.toContain('note.tags');
    expect(res.detail).not.toContain(blob);
    expect(res.detail).not.toContain('СЕКРЕТНАЯ');
  });

  it('контроль: легаси-plaintext с кириллицей и пробелами не считается провалом', async () => {
    const res = await probe({
      note: [
        {
          id: 1,
          text: 'старая заметка из времён до шифрования, с пробелами',
          tags: 'тег',
        },
      ],
    }).run();
    expect(res.ok).toBe(true);
  });

  it('контроль: легаси-JSON (массив/объект) и пустые значения пропускаются', async () => {
    const res = await probe({
      note: [{ id: 1, text: '', tags: null }],
      user: [{ id: 1, mySchemaIds: ['abandonment'] }],
    }).run();
    expect(res).toMatchObject({ ok: true });
    expect(res.detail).toContain('проверено значений 0');
  });

  it('известный ложный сигнал: латинский plaintext без пробелов ≥40 символов в алфавите base64 неотличим от шифротекста', async () => {
    const lookalike = 'A'.repeat(48);
    const res = await probe({
      note: [{ id: 1, text: lookalike, tags: null }],
    }).run();
    expect(res.ok).toBe(false);
    expect(res.detail).toContain('note.text 1 из 1');
  });

  it('без ENCRYPTION_KEY → ok «выключено», в базу не ходит', async () => {
    const { prisma, findMany } = fakePrisma({});
    const res = await encryptionReadableProbe(prisma, {}, TARGETS).run();
    expect(res).toEqual({ ok: true, detail: 'выключено' });
    expect(findMany).not.toHaveBeenCalled();
    const blank = await encryptionReadableProbe(
      prisma,
      { ENCRYPTION_KEY: '  ' },
      TARGETS,
    ).run();
    expect(blank.detail).toBe('выключено');
  });

  it('читает последние строки по первичному ключу (id, userId — как задано в TARGETS), не больше выборки', async () => {
    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const prisma = new Proxy(
      {},
      {
        get: (_t, name: string) => ({
          findMany: async (args: Record<string, unknown>) => {
            calls.push({ name, args });
            return [];
          },
          updateMany: jest.fn(),
        }),
      },
    ) as unknown as PrismaService;
    await encryptionReadableProbe(
      prisma,
      { ENCRYPTION_KEY: 'k' },
      TARGETS,
      50,
    ).run();
    const byName = Object.fromEntries(calls.map((c) => [c.name, c.args]));
    expect(byName.note).toEqual({
      select: { id: true, text: true, tags: true },
      take: 50,
      orderBy: [{ id: 'desc' }],
    });
    expect(byName.userSafePlace).toEqual({
      select: { userId: true, description: true },
      take: 50,
      orderBy: [{ userId: 'desc' }],
    });
  });

  it('ошибка чтения одной таблицы не прячет остальные: не ok, имя таблицы и причина в detail', async () => {
    const prisma = new Proxy(
      {},
      {
        get: (_t, name: string) => ({
          findMany: async () => {
            if (name === 'user') throw new Error('connection refused');
            return [{ id: 1, text: foreign('x'), tags: null }];
          },
          updateMany: jest.fn(),
        }),
      },
    ) as unknown as PrismaService;
    const res = await encryptionReadableProbe(
      prisma,
      { ENCRYPTION_KEY: 'k' },
      TARGETS,
    ).run();
    expect(res.ok).toBe(false);
    expect(res.detail).toContain('note.text 1 из 1');
    expect(res.detail).toContain('user (connection refused)');
  });

  it('проба не в /health и не critical (остаток не уходит сам, красный /health держал бы смок)', () => {
    const p = probe({});
    expect(p).toMatchObject({
      id: 'encryptionReadable',
      critical: false,
      reportInHealth: false,
    });
  });
});

describe('describeTallies', () => {
  const col = (column: string, checked: number, unreadable: number) => ({
    column,
    checked,
    unreadable,
  });

  it('больше шести колонок: перечислены шесть, остальные — числом; detail не длиннее 300', () => {
    const tallies = Array.from({ length: 9 }, (_, i) =>
      col(`таблица${i}.колонка`, 10, 1),
    );
    const res = describeTallies(tallies, [], 200);
    expect(res.detail).toContain('9 знач.');
    expect(res.detail).toContain('таблица5.колонка 1 из 10');
    expect(res.detail).not.toContain('таблица6.колонка');
    expect(res.detail).toContain('ещё колонок: 3');
    expect(res.detail.length).toBeLessThanOrEqual(300);
  });

  it('ровно шесть колонок: «ещё колонок» не пишется', () => {
    const tallies = Array.from({ length: 6 }, (_, i) => col(`t${i}.c`, 1, 1));
    expect(describeTallies(tallies, [], 200).detail).not.toContain('ещё');
  });
});

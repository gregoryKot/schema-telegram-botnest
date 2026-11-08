// DTO-рефактор inline-типов @Body() в diary.controller.ts
// (аудит 2026-07, 2г / правило №6 CLAUDE.md).
import { readFileSync } from 'fs';
import { join } from 'path';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SchemaDiaryDto, ModeDiaryDto } from './diary-entries.dto';
import { GratitudeDiaryDto } from './gratitude-diary.dto';

async function errorsFor(
  cls: new () => object,
  body: Record<string, unknown>,
): Promise<string[]> {
  const dto = plainToInstance(cls, body);
  const errs = await validate(dto, { whitelist: true });
  return errs.map((e) => e.property);
}

describe('SchemaDiaryDto', () => {
  const VALID = {
    trigger: 'опоздал коллега',
    emotions: [{ id: 'anger', intensity: 7 }],
    schemaIds: ['abandonment'],
  };

  it('валидное тело проходит', async () => {
    await expect(errorsFor(SchemaDiaryDto, VALID)).resolves.toEqual([]);
  });

  it('больше 50 эмоций — отказ', async () => {
    const emotions = Array.from({ length: 51 }, () => ({
      id: 'anger',
      intensity: 1,
    }));
    await expect(
      errorsFor(SchemaDiaryDto, { ...VALID, emotions }),
    ).resolves.toContain('emotions');
  });

  // Аудит 2026-11, S21: emotions без @ValidateNested принимал любые объекты.
  it.each([
    ['id не из формата каталога', { id: 'Anger<b>', intensity: 3 }],
    ['id длиннее 64', { id: 'a'.repeat(65), intensity: 3 }],
    ['id не строка', { id: 5, intensity: 3 }],
    ['intensity дробная', { id: 'anger', intensity: 2.5 }],
    ['intensity 0', { id: 'anger', intensity: 0 }],
    ['intensity больше 10', { id: 'anger', intensity: 11 }],
    ['intensity строкой', { id: 'anger', intensity: '3' }],
    ['без intensity', { id: 'anger' }],
    ['не объект', 'anger'],
  ])('эмоция: %s → отказ', async (_, emotion) => {
    await expect(
      errorsFor(SchemaDiaryDto, { ...VALID, emotions: [emotion] }),
    ).resolves.toContain('emotions');
  });

  it('эмоция с лишним полем: whitelist срезает его, запись проходит', async () => {
    const dto = plainToInstance(SchemaDiaryDto, {
      ...VALID,
      emotions: [{ id: 'anger', intensity: 5, note: 'x'.repeat(100_000) }],
    });
    await expect(validate(dto, { whitelist: true })).resolves.toEqual([]);
    expect(dto.emotions[0]).toEqual({ id: 'anger', intensity: 5 });
  });

  it.each([1, 5, 10])(
    'intensity %i — проходит (шкала сайта 1..5)',
    async (n) => {
      await expect(
        errorsFor(SchemaDiaryDto, {
          ...VALID,
          emotions: [{ id: 'anxiety', intensity: n }],
        }),
      ).resolves.toEqual([]);
    },
  );

  it('schemaIds не массив строк — отказ', async () => {
    await expect(
      errorsFor(SchemaDiaryDto, { ...VALID, schemaIds: [1, 2] }),
    ).resolves.toContain('schemaIds');
  });
});

describe('ModeDiaryDto', () => {
  it('валидное тело проходит', async () => {
    await expect(
      errorsFor(ModeDiaryDto, { modeId: 'vulnerable_child', situation: 'x' }),
    ).resolves.toEqual([]);
  });

  // Реестр docs/open/backend.md: modeId проверялся только на непустоту и
  // ложился в базу любой длины (тело запроса — до 256 КБ).
  it.each([
    ['длиннее 64', 'a'.repeat(65)],
    ['не формат каталога', 'Vulnerable-Child'],
    ['разметка', '<b>x</b>'],
    ['пусто', ''],
    ['не строка', 5],
  ])('modeId %s — отказ', async (_, modeId) => {
    await expect(
      errorsFor(ModeDiaryDto, { modeId, situation: 'x' }),
    ).resolves.toContain('modeId');
  });

  it('modeId ровно 64 знака — проходит (граница включительно)', async () => {
    await expect(
      errorsFor(ModeDiaryDto, { modeId: 'a'.repeat(64), situation: 'x' }),
    ).resolves.toEqual([]);
  });
});

describe('SchemaDiaryDto.schemaIds — граница каждого id', () => {
  const body = (schemaIds: unknown[]) => ({
    trigger: 't',
    emotions: [],
    schemaIds,
  });

  it.each([
    ['id длиннее 64', ['abandonment', 'a'.repeat(65)]],
    ['id не формата каталога', ['abandonment', 'Bad Id']],
    ['больше 50 id', Array.from({ length: 51 }, () => 'abandonment')],
  ])('%s — отказ', async (_, ids) => {
    await expect(errorsFor(SchemaDiaryDto, body(ids))).resolves.toContain(
      'schemaIds',
    );
  });
});

// Правило №4: формат id в DTO и каталог, из которого фронты берут id
// (MODE_GROUPS, SCHEMA_DOMAINS), обязаны совпадать — иначе запись настоящего
// режима или схемы получала бы 400.
describe('каталог схем и режимов проходит DTO', () => {
  const CONTENT = join(__dirname, '../../../shared/src/schemaTherapy/content');
  const idsOf = (file: string) =>
    [
      ...readFileSync(join(CONTENT, file), 'utf8').matchAll(/\bid: '([^']*)'/g),
    ].map((m) => m[1]);

  it('каждый id из modeGroups.ts — валидный modeId', async () => {
    const ids = idsOf('modeGroups.ts');
    expect(ids.length).toBeGreaterThan(20);
    for (const modeId of ids)
      expect([
        modeId,
        await errorsFor(ModeDiaryDto, { modeId, situation: 'x' }),
      ]).toEqual([modeId, []]);
  });

  it('все id из schemaDomains.ts — валидные schemaIds', async () => {
    const ids = idsOf('schemaDomains.ts');
    expect(ids.length).toBeGreaterThan(18);
    for (let i = 0; i < ids.length; i += 50)
      await expect(
        errorsFor(SchemaDiaryDto, {
          trigger: 't',
          emotions: [],
          schemaIds: ids.slice(i, i + 50),
        }),
      ).resolves.toEqual([]);
  });
});

describe('GratitudeDiaryDto', () => {
  it('валидное тело проходит', async () => {
    await expect(
      errorsFor(GratitudeDiaryDto, {
        date: '2026-07-14',
        items: ['спасибо солнцу'],
      }),
    ).resolves.toEqual([]);
  });

  it('пустой список items — отказ', async () => {
    await expect(
      errorsFor(GratitudeDiaryDto, { date: '2026-07-14', items: [] }),
    ).resolves.toContain('items');
  });

  it('больше 20 items — отказ', async () => {
    const items = Array.from({ length: 21 }, (_, i) => `item ${i}`);
    await expect(
      errorsFor(GratitudeDiaryDto, { date: '2026-07-14', items }),
    ).resolves.toContain('items');
  });

  it('base — необязательный список строк: пустой проходит, не-строки — отказ', async () => {
    await expect(
      errorsFor(GratitudeDiaryDto, {
        date: '2026-07-14',
        items: ['а'],
        base: [],
      }),
    ).resolves.toEqual([]);
    await expect(
      errorsFor(GratitudeDiaryDto, {
        date: '2026-07-14',
        items: ['а'],
        base: [1],
      }),
    ).resolves.toContain('base');
  });

  it('base длиннее лимита в пункте — отказ (верхняя граница строки)', async () => {
    await expect(
      errorsFor(GratitudeDiaryDto, {
        date: '2026-07-14',
        items: ['а'],
        base: ['x'.repeat(100_000)],
      }),
    ).resolves.toContain('base');
  });
});

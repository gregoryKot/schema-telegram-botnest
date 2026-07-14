// DTO-рефактор inline-типов @Body() в diary.controller.ts
// (аудит 2026-07, 2г / правило №6 CLAUDE.md).
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  SchemaDiaryDto,
  ModeDiaryDto,
  GratitudeDiaryDto,
} from './diary-entries.dto';

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
});

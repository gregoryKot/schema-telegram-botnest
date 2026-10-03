// DTO-рефактор inline-типов @Body() для задач терапевта
// (аудит 2026-07, 2г / правило №6 CLAUDE.md).
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateTaskDto, CompleteTaskDto } from './tasks.dto';

async function errorsFor(
  cls: new () => object,
  body: Record<string, unknown>,
): Promise<string[]> {
  const dto = plainToInstance(cls, body);
  const errs = await validate(dto, { whitelist: true });
  return errs.map((e) => e.property);
}

describe('CreateTaskDto', () => {
  const VALID = { type: 'custom', text: 'дневник схемы каждый день' };

  it('валидное тело проходит', async () => {
    await expect(errorsFor(CreateTaskDto, VALID)).resolves.toEqual([]);
  });

  it('targetDays вне 1–365 — отказ', async () => {
    await expect(
      errorsFor(CreateTaskDto, { ...VALID, targetDays: 0 }),
    ).resolves.toContain('targetDays');
    await expect(
      errorsFor(CreateTaskDto, { ...VALID, targetDays: 366 }),
    ).resolves.toContain('targetDays');
  });

  it('пустой text — отказ', async () => {
    await expect(
      errorsFor(CreateTaskDto, { ...VALID, text: '' }),
    ).resolves.toContain('text');
  });
});

// Аудит 2026-10, T6: type — закрытый список, needId/dueDate ограничены.
describe('CreateTaskDto — type/needId/dueDate (T6)', () => {
  const VALID = { type: 'custom', text: 'задание' };

  it('все типы из форм создания обоих фронтендов проходят', async () => {
    for (const type of [
      'diary_streak',
      'tracker_streak',
      'belief_check',
      'letter_to_self',
      'safe_place',
      'flashcard',
      'schema_intro',
      'mode_intro',
      'custom',
    ])
      await expect(
        errorsFor(CreateTaskDto, { ...VALID, type }),
      ).resolves.toEqual([]);
  });

  it('неизвестный type — отказ', async () => {
    await expect(
      errorsFor(CreateTaskDto, { ...VALID, type: 'rm -rf' }),
    ).resolves.toContain('type');
    await expect(
      errorsFor(CreateTaskDto, { ...VALID, type: 'x'.repeat(10_000) }),
    ).resolves.toContain('type');
  });

  it('dueDate — только YYYY-MM-DD', async () => {
    await expect(
      errorsFor(CreateTaskDto, { ...VALID, dueDate: '2026-10-10' }),
    ).resolves.toEqual([]);
    await expect(
      errorsFor(CreateTaskDto, { ...VALID, dueDate: '10.10.2026' }),
    ).resolves.toContain('dueDate');
  });

  it('needId длиннее 64 — отказ', async () => {
    await expect(
      errorsFor(CreateTaskDto, { ...VALID, needId: 'a'.repeat(65) }),
    ).resolves.toContain('needId');
    await expect(
      errorsFor(CreateTaskDto, { ...VALID, needId: 'attachment' }),
    ).resolves.toEqual([]);
  });
});

describe('CompleteTaskDto', () => {
  it('done обязателен и должен быть boolean', async () => {
    await expect(errorsFor(CompleteTaskDto, {})).resolves.toContain('done');
    await expect(errorsFor(CompleteTaskDto, { done: true })).resolves.toEqual(
      [],
    );
  });
});

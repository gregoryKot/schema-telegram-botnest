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

describe('CompleteTaskDto', () => {
  it('done обязателен и должен быть boolean', async () => {
    await expect(errorsFor(CompleteTaskDto, {})).resolves.toContain('done');
    await expect(errorsFor(CompleteTaskDto, { done: true })).resolves.toEqual(
      [],
    );
  });
});

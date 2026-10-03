// DTO-рефактор inline-типов @Body() для практик/планов
// (аудит 2026-07, 2г / правило №6 CLAUDE.md).
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AddPracticeDto, CreatePlanDto } from './practice-plan.dto';

async function errorsFor(
  cls: new () => object,
  body: Record<string, unknown>,
): Promise<string[]> {
  const dto = plainToInstance(cls, body);
  const errs = await validate(dto, { whitelist: true });
  return errs.map((e) => e.property);
}

describe('AddPracticeDto', () => {
  it('needId вне списка потребностей — отказ', async () => {
    await expect(
      errorsFor(AddPracticeDto, { needId: 'hacked', text: 'дыши' }),
    ).resolves.toContain('needId');
  });

  it('валидное тело проходит', async () => {
    await expect(
      errorsFor(AddPracticeDto, { needId: 'play', text: 'дыши' }),
    ).resolves.toEqual([]);
  });
});

describe('CreatePlanDto', () => {
  it('валидное тело проходит', async () => {
    await expect(
      errorsFor(CreatePlanDto, {
        needId: 'play',
        practiceText: 'прогулка',
        reminderUtcHour: 9,
      }),
    ).resolves.toEqual([]);
  });

  // M5 (аудит 2026-10): час UTC вне 0..23 раньше проходил и ломал sendAt.
  it.each([-1, 24, 99, 1.5])('reminderUtcHour=%p — отказ', async (hour) => {
    await expect(
      errorsFor(CreatePlanDto, {
        needId: 'play',
        practiceText: 'прогулка',
        reminderUtcHour: hour,
      }),
    ).resolves.toContain('reminderUtcHour');
  });

  it.each([0, 23])('граничный reminderUtcHour=%p проходит', async (hour) => {
    await expect(
      errorsFor(CreatePlanDto, {
        needId: 'play',
        practiceText: 'прогулка',
        reminderUtcHour: hour,
      }),
    ).resolves.toEqual([]);
  });

  it('пустой practiceText — отказ', async () => {
    await expect(
      errorsFor(CreatePlanDto, { needId: 'play', practiceText: '' }),
    ).resolves.toContain('practiceText');
  });
});

// DTO-рефактор inline-типов @Body() админ-эндпоинтов бронирования
// (аудит 2026-07, 2г / правило №6 CLAUDE.md).
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CreateRuleDto,
  SetPriceDto,
  SetSubPriceDto,
  ToggleRuleDto,
} from './booking-admin.dto';

async function errorsFor(
  cls: new () => object,
  body: Record<string, unknown>,
): Promise<string[]> {
  const dto = plainToInstance(cls, body);
  const errs = await validate(dto, { whitelist: true });
  return errs.map((e) => e.property);
}

describe('SetPriceDto', () => {
  it('валидный тип сессии проходит', async () => {
    await expect(
      errorsFor(SetPriceDto, { type: 'SESSION_50', amount: 3000 }),
    ).resolves.toEqual([]);
  });

  it('неизвестный тип сессии — отказ', async () => {
    await expect(
      errorsFor(SetPriceDto, { type: 'FREE_FOREVER', amount: 0 }),
    ).resolves.toContain('type');
  });
});

describe('SetSubPriceDto', () => {
  it('period вне month/year — отказ', async () => {
    await expect(
      errorsFor(SetSubPriceDto, { period: 'week', amount: 500 }),
    ).resolves.toContain('period');
  });

  it('валидный period проходит', async () => {
    await expect(
      errorsFor(SetSubPriceDto, { period: 'year', amount: 5000 }),
    ).resolves.toEqual([]);
  });
});

describe('ToggleRuleDto', () => {
  it('isActive должен быть boolean', async () => {
    await expect(
      errorsFor(ToggleRuleDto, { isActive: 'yes' }),
    ).resolves.toContain('isActive');
  });
});

// CreateRuleDto (аудит 2026-08-14, правило №6): раньше был interface в
// availability.service.ts — dayOfWeek/часы летели в prisma без единой
// проверки типа/диапазона.
describe('CreateRuleDto', () => {
  const VALID = {
    dayOfWeek: 1,
    startHour: 9,
    endHour: 18,
  };

  it('валидное правило (только обязательные поля) проходит', async () => {
    await expect(errorsFor(CreateRuleDto, VALID)).resolves.toEqual([]);
  });

  it('валидное правило со всеми опциональными полями проходит', async () => {
    await expect(
      errorsFor(CreateRuleDto, {
        ...VALID,
        startMinute: 30,
        endMinute: 45,
        sessionDuration: 50,
        bufferMin: 10,
        timezone: 'Europe/Moscow',
      }),
    ).resolves.toEqual([]);
  });

  it('dayOfWeek вне диапазона 0..6 — отказ', async () => {
    await expect(
      errorsFor(CreateRuleDto, { ...VALID, dayOfWeek: 99 }),
    ).resolves.toContain('dayOfWeek');
  });

  it('dayOfWeek строкой — отказ (ValidationPipe без enableImplicitConversion строку не приводит к числу)', async () => {
    await expect(
      errorsFor(CreateRuleDto, { ...VALID, dayOfWeek: '3' }),
    ).resolves.toContain('dayOfWeek');
  });

  it('endHour вне диапазона 0..24 — отказ', async () => {
    await expect(
      errorsFor(CreateRuleDto, { ...VALID, endHour: 30 }),
    ).resolves.toContain('endHour');
  });
});

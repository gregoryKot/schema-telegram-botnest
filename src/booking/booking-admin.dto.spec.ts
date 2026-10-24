// DTO-рефактор inline-типов @Body() админ-эндпоинтов бронирования
// (аудит 2026-07, 2г / правило №6 CLAUDE.md).
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateRuleDto, ToggleRuleDto } from './booking-admin.dto';
import { SetPriceDto, SetSubPriceDto } from './booking-price.dto';

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

  it.each(['RUB', 'ILS', 'EUR', 'USD'])(
    'валюта %s проходит',
    async (currency) => {
      await expect(
        errorsFor(SetPriceDto, { type: 'SESSION_50', amount: 70, currency }),
      ).resolves.toEqual([]);
    },
  );

  it.each(['GBP', 'usd', '', 70])(
    'неизвестная валюта %p — отказ',
    async (currency) => {
      await expect(
        errorsFor(SetPriceDto, { type: 'SESSION_50', amount: 70, currency }),
      ).resolves.toContain('currency');
    },
  );

  it('неизвестный тип сессии — отказ', async () => {
    await expect(
      errorsFor(SetPriceDto, { type: 'FREE_FOREVER', amount: 0 }),
    ).resolves.toContain('type');
  });

  // 1e22 раньше превращалось в 1 ₽ при разборе parseInt; потолок — в DTO.
  it.each([1e22, -1, 1_000_001, NaN, '3000'])(
    'сумма %p вне границ или не число — отказ',
    async (amount) => {
      await expect(
        errorsFor(SetPriceDto, { type: 'SESSION_50', amount }),
      ).resolves.toContain('amount');
    },
  );

  it('границы проходят: 0 (знакомство; платный минимум проверяет сервис) и потолок', async () => {
    for (const amount of [0, 1, 1_000_000]) {
      await expect(
        errorsFor(SetPriceDto, { type: 'INTRO_15', amount }),
      ).resolves.toEqual([]);
    }
  });
});

describe('SetSubPriceDto', () => {
  it('period вне month/year — отказ', async () => {
    await expect(
      errorsFor(SetSubPriceDto, { period: 'week', amount: 500 }),
    ).resolves.toContain('period');
  });

  it.each([0, -1, 1e22, 1_000_001])(
    'сумма подписки %p вне 1…1 000 000 — отказ (цена подписки > 0)',
    async (amount) => {
      await expect(
        errorsFor(SetSubPriceDto, { period: 'month', amount }),
      ).resolves.toContain('amount');
    },
  );

  it('границы проходят: 1 и потолок', async () => {
    for (const amount of [1, 1_000_000]) {
      await expect(
        errorsFor(SetSubPriceDto, { period: 'month', amount }),
      ).resolves.toEqual([]);
    }
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

// DTO-рефактор inline-типов @Body() админ-эндпоинтов бронирования
// (аудит 2026-07, 2г / правило №6 CLAUDE.md).
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
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

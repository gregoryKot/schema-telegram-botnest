// resolveBookingPrice: валюта по поясу, сумма из PricingService, холд и
// признак «платная не в рублях» (manual). book() целиком — в
// booking.book-currency.spec.ts, здесь — сама развилка.
import { SessionType } from '@prisma/client';
import {
  HOLD_MINUTES,
  pathLabel,
  resolveBookingPrice,
} from './booking-pricing-path';

const NOW = Date.parse('2026-10-20T12:00:00Z');
const pricing = () => ({
  getPrice: jest.fn(async (_t: SessionType, c?: string) =>
    c === 'USD' ? 70 : 4000,
  ),
});

describe('resolveBookingPrice', () => {
  it('рубли (Москва): сумма из getPrice, холд 15 минут, не manual', async () => {
    const p = pricing();
    const r = await resolveBookingPrice(
      p,
      { type: SessionType.SESSION_50, clientTimeZone: 'Europe/Moscow' },
      NOW,
    );
    expect(r).toEqual({
      isFree: false,
      currency: 'RUB',
      manual: false,
      amount: 4000,
      heldUntil: new Date(NOW + HOLD_MINUTES * 60_000),
    });
    expect(p.getPrice).toHaveBeenCalledWith(SessionType.SESSION_50, 'RUB');
  });

  it('доллары (Бангкок): manual, цена в долларах, без холда', async () => {
    const p = pricing();
    const r = await resolveBookingPrice(
      p,
      { type: SessionType.SESSION_50, clientTimeZone: 'Asia/Bangkok' },
      NOW,
    );
    expect(r).toMatchObject({
      currency: 'USD',
      manual: true,
      amount: 70,
      heldUntil: null,
    });
    expect(p.getPrice).toHaveBeenCalledWith(SessionType.SESSION_50, 'USD');
  });

  it('без пояса и с невалидным — рубли', async () => {
    for (const tz of [undefined, '', 'Europe/Nonexistent', 'мусор']) {
      const r = await resolveBookingPrice(pricing(), {
        type: SessionType.SESSION_50,
        clientTimeZone: tz,
      });
      expect(r).toMatchObject({ currency: 'RUB', manual: false });
    }
  });

  it('знакомство: бесплатно, не manual даже из-за границы, цена не читается', async () => {
    const p = pricing();
    const r = await resolveBookingPrice(
      p,
      { type: SessionType.INTRO_15, clientTimeZone: 'Asia/Jerusalem' },
      NOW,
    );
    expect(r).toMatchObject({
      isFree: true,
      manual: false,
      amount: null,
      heldUntil: null,
    });
    expect(p.getPrice).not.toHaveBeenCalled();
  });
});

describe('pathLabel', () => {
  const base = {
    isFree: false,
    currency: 'RUB' as const,
    manual: false,
    amount: 1,
    heldUntil: null,
  };
  it('подписи для лога', () => {
    expect(pathLabel({ ...base, heldUntil: new Date() })).toBe('HELD');
    expect(pathLabel({ ...base, isFree: true, amount: null })).toBe(
      'CONFIRMED',
    );
    expect(pathLabel({ ...base, manual: true, currency: 'USD' })).toBe(
      'CONFIRMED, manual payment USD',
    );
  });
});

// resolveBookingPrice: валюта по поясу, сумма из PricingService, холд и
// признак «платная не в рублях» (manual). book() целиком — в
// booking.book.spec.ts («страна посетителя»), здесь — сама развилка.
import { SessionType } from '@prisma/client';
import {
  HOLD_MINUTES,
  pathLabel,
  resolveBookingPrice,
  trackExplicitCurrency,
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
      explicit: false,
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

  // Решение владельца Р5 (2026-11-08, аудит 2026-11 R9): UTC — «пояс
  // неизвестен» (так его отдают браузеры с защитой от отпечатка), а не
  // заграница. Раньше UTC давал доллары и бронь без предоплаты.
  it.each(['UTC', 'Etc/UTC', 'Etc/GMT'])(
    '%s — рубли с предоплатой: холд 15 минут, не manual',
    async (tz) => {
      const r = await resolveBookingPrice(
        pricing(),
        { type: SessionType.SESSION_50, clientTimeZone: tz },
        NOW,
      );
      expect(r).toMatchObject({
        currency: 'RUB',
        manual: false,
        amount: 4000,
        heldUntil: new Date(NOW + HOLD_MINUTES * 60_000),
      });
    },
  );

  it('КОНТРОЛЬ: пояс со смещением Etc/GMT-3 — по-прежнему заграница', async () => {
    const r = await resolveBookingPrice(
      pricing(),
      { type: SessionType.SESSION_50, clientTimeZone: 'Etc/GMT-3' },
      NOW,
    );
    expect(r).toMatchObject({ currency: 'USD', manual: true });
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

// Решение владельца Р5: заграница при неизвестном поясе — по явному выбору
// валюты. Выбор действует только при поясе без места; при настоящем поясе он
// игнорируется — иначе клиент из России выбрал бы евро и обошёл предоплату.
describe('resolveBookingPrice — явный выбор валюты (Р5)', () => {
  const eurPricing = () => ({
    getPrice: jest.fn(async (_t: SessionType, c?: string) =>
      c === 'EUR' ? 65 : 4000,
    ),
  });

  it.each(['UTC', 'Etc/UTC', 'GMT'])(
    'пояс %s + EUR: евро, manual, без холда, explicit',
    async (tz) => {
      const p = eurPricing();
      const r = await resolveBookingPrice(
        p,
        { type: SessionType.SESSION_50, clientTimeZone: tz, currency: 'EUR' },
        NOW,
      );
      expect(r).toEqual({
        isFree: false,
        currency: 'EUR',
        manual: true,
        amount: 65,
        heldUntil: null,
        explicit: true,
      });
      expect(p.getPrice).toHaveBeenCalledWith(SessionType.SESSION_50, 'EUR');
    },
  );

  it.each([
    ['Europe/Moscow', 'RUB'],
    ['Asia/Yekaterinburg', 'RUB'],
    ['Asia/Bangkok', 'USD'],
    // Невалидный пояс — как пустой: не «без места», выбор не действует.
    ['мусор', 'RUB'],
    [undefined, 'RUB'],
  ])(
    'настоящий или пустой пояс %p + EUR: выбор игнорируется → %s',
    async (tz, currency) => {
      const r = await resolveBookingPrice(
        eurPricing(),
        { type: SessionType.SESSION_50, clientTimeZone: tz, currency: 'EUR' },
        NOW,
      );
      expect(r).toMatchObject({ currency, explicit: false });
      expect(r.manual).toBe(currency !== 'RUB');
    },
  );

  it('Москва + EUR: рубли с предоплатой — холд 15 минут, не manual', async () => {
    const r = await resolveBookingPrice(
      eurPricing(),
      {
        type: SessionType.SESSION_50,
        clientTimeZone: 'Europe/Moscow',
        currency: 'EUR',
      },
      NOW,
    );
    expect(r).toMatchObject({
      currency: 'RUB',
      manual: false,
      amount: 4000,
      heldUntil: new Date(NOW + HOLD_MINUTES * 60_000),
    });
  });

  it('UTC без выбора и с выбором RUB — рубли с предоплатой, как раньше', async () => {
    for (const currency of [undefined, 'RUB' as const]) {
      const r = await resolveBookingPrice(
        eurPricing(),
        { type: SessionType.SESSION_50, clientTimeZone: 'UTC', currency },
        NOW,
      );
      expect(r).toMatchObject({
        currency: 'RUB',
        manual: false,
        explicit: false,
        heldUntil: new Date(NOW + HOLD_MINUTES * 60_000),
      });
    }
  });
});

describe('trackExplicitCurrency', () => {
  const path = {
    isFree: false,
    currency: 'EUR' as const,
    manual: true,
    amount: 65,
    heldUntil: null,
  };

  it('явный выбор — серверное событие без userId, meta — только валюта', async () => {
    const track = jest.fn(async () => undefined);
    await trackExplicitCurrency({ track }, { ...path, explicit: true });
    expect(track).toHaveBeenCalledWith(null, 'booking_currency_chosen', {
      currency: 'EUR',
    });
  });

  it('валюта по поясу — события нет; без сервиса аналитики не падает', async () => {
    const track = jest.fn(async () => undefined);
    await trackExplicitCurrency({ track }, { ...path, explicit: false });
    expect(track).not.toHaveBeenCalled();
    await expect(
      trackExplicitCurrency(undefined, { ...path, explicit: true }),
    ).resolves.toBeUndefined();
  });
});

describe('pathLabel', () => {
  const base = {
    isFree: false,
    currency: 'RUB' as const,
    manual: false,
    amount: 1,
    heldUntil: null,
    explicit: false,
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

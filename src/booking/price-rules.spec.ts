// Правила цены (аудит 2026-10-11, «цена платной сессии может быть 0»).
import { SessionType } from '@prisma/client';
import { minPrice, parsePrice, payableAmount, PRICE_MAX } from './price-rules';

describe('minPrice', () => {
  it('знакомство бесплатно по типу (0), платная сессия — от 1 ₽', () => {
    expect(minPrice(SessionType.INTRO_15)).toBe(0);
    expect(minPrice(SessionType.SESSION_50)).toBe(1);
  });
});

describe('parsePrice', () => {
  it('нет значения — null (вызывающий берёт дефолт)', () => {
    expect(parsePrice(SessionType.SESSION_50, undefined)).toBeNull();
  });

  it('границы по типу: 0 — только знакомству, потолок включительно', () => {
    expect(parsePrice(SessionType.INTRO_15, '0')).toBe(0);
    expect(parsePrice(SessionType.SESSION_50, '0')).toBeNull();
    expect(parsePrice(SessionType.SESSION_50, '1')).toBe(1);
    expect(parsePrice(SessionType.SESSION_50, String(PRICE_MAX))).toBe(
      PRICE_MAX,
    );
    expect(
      parsePrice(SessionType.SESSION_50, String(PRICE_MAX + 1)),
    ).toBeNull();
  });

  it('только запись целого числа: экспонента, дробь, минус, хвост — null', () => {
    for (const raw of ['1e+22', '1e3', '3000.5', '-5', '12abc', '', ' ']) {
      expect([raw, parsePrice(SessionType.SESSION_50, raw)]).toEqual([
        raw,
        null,
      ]);
    }
  });
});

describe('payableAmount', () => {
  it('положительная конечная сумма проходит как есть', () => {
    expect(payableAmount(3000)).toBe(3000);
    expect(payableAmount(0.01)).toBe(0.01);
  });

  it.each([0, -1, NaN, Infinity, -Infinity])(
    'счёт на %p не выставляем — бросок',
    (amount) => {
      expect(() => payableAmount(amount)).toThrow('Invalid payment amount');
    },
  );
});

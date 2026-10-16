// PricingService — источник правды для суммы, которую спишет Robokassa.
// Ошибка тут напрямую бьёт по деньгам (списали не ту сумму / не тот прайс).
import { SessionType } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';
import { PricingService } from './pricing.service';
import { PRICE_MAX } from './price-rules';
import { SESSION_DEFAULT_PRICE, SESSION_META } from './booking.config';

function makeService(rows: Record<string, string> = {}) {
  const store = new Map(Object.entries(rows));
  const prisma: any = {
    bookingSetting: {
      findUnique: jest.fn(({ where }: any) => {
        const v = store.get(where.key);
        return Promise.resolve(
          v === undefined ? null : { key: where.key, value: v },
        );
      }),
      upsert: jest.fn(({ where, create, update }: any) => {
        store.set(where.key, (update ?? create).value);
        return Promise.resolve({ key: where.key, value: store.get(where.key) });
      }),
    },
  };
  return { service: new PricingService(prisma), prisma, store };
}

describe('PricingService.getPrice', () => {
  it('нет строки в BookingSetting — возвращает дефолт из конфига', async () => {
    const { service } = makeService();
    expect(await service.getPrice(SessionType.SESSION_50)).toBe(
      SESSION_DEFAULT_PRICE[SessionType.SESSION_50],
    );
  });

  it('есть валидный override в БД — возвращает его, а не дефолт', async () => {
    const { service } = makeService({ 'price:SESSION_50': '5500' });
    expect(await service.getPrice(SessionType.SESSION_50)).toBe(5500);
  });

  it('override = "0" — валиден, возвращается 0 (не путается с "нет строки")', async () => {
    const { service } = makeService({ 'price:INTRO_15': '0' });
    expect(await service.getPrice(SessionType.INTRO_15)).toBe(0);
  });

  it('override нечисловой ("abc") — откатывается на дефолт', async () => {
    const { service } = makeService({ 'price:SESSION_50': 'abc' });
    expect(await service.getPrice(SessionType.SESSION_50)).toBe(
      SESSION_DEFAULT_PRICE[SessionType.SESSION_50],
    );
  });

  it('override отрицательный — откатывается на дефолт (цена не может быть < 0)', async () => {
    const { service } = makeService({ 'price:SESSION_50': '-100' });
    expect(await service.getPrice(SessionType.SESSION_50)).toBe(
      SESSION_DEFAULT_PRICE[SessionType.SESSION_50],
    );
  });

  // Решение сменено (аудит 2026-10-11, находка «цена платной сессии может быть
  // 0»): раньше тут был запин «0 на SESSION_50 возвращает 0» против мутанта
  // `>=0` vs `>0`. Но бесплатность определяется типом (INTRO_15), а не ценой, и
  // SESSION_50 за 0 ставил бронь в HELD со счётом Robokassa на 0,00 ₽. Теперь
  // для платного типа граница — 1, и мутант `>=1` vs `>=0` убивают «0» (дефолт)
  // и «1» (именно 1) в паре.
  it('override "0" на SESSION_50 — не цена платной сессии, откат на дефолт', async () => {
    const { service } = makeService({ 'price:SESSION_50': '0' });
    expect(await service.getPrice(SessionType.SESSION_50)).toBe(
      SESSION_DEFAULT_PRICE[SessionType.SESSION_50],
    );
  });

  it('граница снизу: "1" на SESSION_50 — это 1 ₽, а не дефолт', async () => {
    const { service } = makeService({ 'price:SESSION_50': '1' });
    expect(await service.getPrice(SessionType.SESSION_50)).toBe(1);
  });

  it('граница сверху: PRICE_MAX проходит, PRICE_MAX+1 — дефолт', async () => {
    const top = makeService({ 'price:SESSION_50': String(PRICE_MAX) });
    expect(await top.service.getPrice(SessionType.SESSION_50)).toBe(PRICE_MAX);
    const over = makeService({ 'price:SESSION_50': String(PRICE_MAX + 1) });
    expect(await over.service.getPrice(SessionType.SESSION_50)).toBe(
      SESSION_DEFAULT_PRICE[SessionType.SESSION_50],
    );
  });

  it.each(['1e+22', '1e3', '3000.5', '', '  ', '12abc', '0x10'])(
    'не целое число ("%s") — дефолт: parseInt превращал "1e+22" в 1 ₽',
    async (raw) => {
      const { service } = makeService({ 'price:SESSION_50': raw });
      expect(await service.getPrice(SessionType.SESSION_50)).toBe(
        SESSION_DEFAULT_PRICE[SessionType.SESSION_50],
      );
    },
  );

  it('пробелы вокруг числа не мешают', async () => {
    const { service } = makeService({ 'price:SESSION_50': ' 4100 ' });
    expect(await service.getPrice(SessionType.SESSION_50)).toBe(4100);
  });

  it('INTRO_15: "0" законно, потолок тот же', async () => {
    const zero = makeService({ 'price:INTRO_15': '0' });
    expect(await zero.service.getPrice(SessionType.INTRO_15)).toBe(0);
    const over = makeService({ 'price:INTRO_15': String(PRICE_MAX + 1) });
    expect(await over.service.getPrice(SessionType.INTRO_15)).toBe(
      SESSION_DEFAULT_PRICE[SessionType.INTRO_15],
    );
  });

  it('ключ различает типы сессий — INTRO_15 и SESSION_50 не пересекаются', async () => {
    const { service, prisma } = makeService({ 'price:INTRO_15': '999' });
    await service.getPrice(SessionType.SESSION_50);
    expect(prisma.bookingSetting.findUnique).toHaveBeenCalledWith({
      where: { key: 'price:SESSION_50' },
    });
  });
});

describe('PricingService.setPrice', () => {
  it('округляет и сохраняет как строку', async () => {
    const { service, store } = makeService();
    await service.setPrice(SessionType.SESSION_50, 4499.6);
    expect(store.get('price:SESSION_50')).toBe('4500');
  });

  it.each([0, -50, 0.4, NaN, Infinity, 1e22, PRICE_MAX + 1])(
    'платная сессия: %p — 400 INVALID_PRICE, в БД ничего не пишется',
    async (amount) => {
      const { service, prisma } = makeService();
      await expect(
        service.setPrice(SessionType.SESSION_50, amount),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.setPrice(SessionType.SESSION_50, amount),
      ).rejects.toThrow('INVALID_PRICE');
      expect(prisma.bookingSetting.upsert).not.toHaveBeenCalled();
    },
  );

  it.each([
    [0.5, '1'],
    [1, '1'],
    [PRICE_MAX, String(PRICE_MAX)],
  ])(
    'платная сессия: границы допустимого — %p сохраняется как "%s"',
    async (amount, stored) => {
      const { service, store } = makeService();
      await service.setPrice(SessionType.SESSION_50, amount);
      expect(store.get('price:SESSION_50')).toBe(stored);
    },
  );

  it('знакомство: 0 законно (бесплатность — свойство типа), отрицательное и сверх потолка — 400', async () => {
    const { service, store } = makeService();
    await service.setPrice(SessionType.INTRO_15, 0);
    expect(store.get('price:INTRO_15')).toBe('0');
    await expect(service.setPrice(SessionType.INTRO_15, -1)).rejects.toThrow(
      'INVALID_PRICE',
    );
    await expect(
      service.setPrice(SessionType.INTRO_15, PRICE_MAX + 1),
    ).rejects.toThrow('INVALID_PRICE');
  });

  it('upsert — повторный вызов обновляет существующую строку', async () => {
    const { service, store } = makeService({ 'price:SESSION_50': '4000' });
    await service.setPrice(SessionType.SESSION_50, 5000);
    expect(store.get('price:SESSION_50')).toBe('5000');
  });

  it('upsert вызывается с точным create:{key,value} — не пустым объектом (ObjectLiteral)', async () => {
    const { service, prisma } = makeService();
    await service.setPrice(SessionType.SESSION_50, 5000);
    expect(prisma.bookingSetting.upsert).toHaveBeenCalledWith({
      where: { key: 'price:SESSION_50' },
      create: { key: 'price:SESSION_50', value: '5000' },
      update: { value: '5000' },
    });
  });
});

describe('PricingService.getOptions', () => {
  it('возвращает весь каталог SESSION_META с текущими ценами (override применяется)', async () => {
    const { service } = makeService({ 'price:SESSION_50': '4200' });
    const options = await service.getOptions();
    expect(options).toHaveLength(SESSION_META.length);
    const s50 = options.find((o) => o.type === SessionType.SESSION_50);
    expect(s50?.price).toBe(4200);
    const intro = options.find((o) => o.type === SessionType.INTRO_15);
    expect(intro?.price).toBe(SESSION_DEFAULT_PRICE[SessionType.INTRO_15]);
  });
});

// PricingService — источник правды для суммы, которую спишет Robokassa.
// Ошибка тут напрямую бьёт по деньгам (списали не ту сумму / не тот прайс).
import { SessionType } from '@prisma/client';
import { PricingService } from './pricing.service';
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

  it('отрицательное значение зажимается в 0', async () => {
    const { service, store } = makeService();
    await service.setPrice(SessionType.SESSION_50, -50);
    expect(store.get('price:SESSION_50')).toBe('0');
  });

  it('upsert — повторный вызов обновляет существующую строку', async () => {
    const { service, store } = makeService({ 'price:SESSION_50': '4000' });
    await service.setPrice(SessionType.SESSION_50, 5000);
    expect(store.get('price:SESSION_50')).toBe('5000');
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

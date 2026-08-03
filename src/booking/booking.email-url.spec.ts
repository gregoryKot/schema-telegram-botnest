// Точечное усиление против выживших мутантов в booking.service.ts
// (Stryker waveB): регэксп isEmail (12 пережитых мутаций символьных
// классов/якорей) и полный набор полей payment-URL (successUrl/failUrl/
// desc/siteUrl-дефолт) — "метод вызван" не ловит пустую строку вместо
// реальной ссылки, поэтому здесь сверяем итоговые значения целиком.
import { SessionType } from '@prisma/client';
import { BookingService } from './booking.service';

const FIXED_NOW = new Date('2026-07-13T00:00:00Z'); // понедельник
const INSIDE_WINDOW = new Date(FIXED_NOW.getTime() + 13 * 3_600_000);

function makeService(opts: { siteUrl?: string | undefined } = {}) {
  let nextId = 100;
  const tx = {
    $queryRaw: jest.fn(async () => undefined),
    booking: {
      findMany: jest.fn(async () => []),
      create: jest.fn(async ({ data }: any) => {
        const row = { id: nextId++, ...data };
        return row;
      }),
    },
  };
  const prisma: any = {
    availabilityRule: { findMany: jest.fn(async () => []) },
    $transaction: jest.fn(async (fn: any) => fn(tx)),
    booking: { update: jest.fn(async () => ({})) },
  };
  const notify = {
    onConfirmed: jest.fn(async () => undefined),
    onAwaitingPayment: jest.fn(async () => undefined),
  };
  const meeting = { hasMeetingForContact: jest.fn(async () => true) };
  const robokassa = {
    enabled: true,
    buildPaymentUrl: jest.fn(() => 'https://auth.robokassa.ru/pay?x=1'),
  };
  const pricing = { getPrice: jest.fn(async () => 4000) };
  const config = { get: () => opts.siteUrl };
  const service = new BookingService(
    prisma,
    notify as any,
    meeting as any,
    robokassa as any,
    pricing as any,
    config as any,
  );
  return { service, robokassa };
}

async function bookWithContact(clientContact: string, siteUrl?: string) {
  const { service, robokassa } = makeService({ siteUrl });
  jest.useFakeTimers();
  jest.setSystemTime(FIXED_NOW);
  try {
    await service.book({
      clientName: 'Мария',
      clientContact,
      acceptedOffer: true,
      startsAt: INSIDE_WINDOW,
      durationMin: 50,
      type: SessionType.SESSION_50,
    });
  } finally {
    jest.useRealTimers();
  }
  return robokassa.buildPaymentUrl.mock.calls[0][0];
}

describe('BookingService.book — isEmail определяет, передаём ли email в Robokassa', () => {
  it.each([
    ['a@b.ru', true, 'простой валидный email'],
    ['a@b.c.ru', true, 'email с поддоменом'],
    ['@maria', false, 'telegram-хендл без email — нет локальной части'],
    ['@b.ru', false, 'нет символов перед @'],
    ['a@.ru', false, 'нет символов между @ и точкой'],
    ['a@b', false, 'нет точки вовсе'],
    ['a@b.', false, 'нет символов после точки (TLD)'],
    ['a b@c.ru', false, 'пробел в локальной части'],
    ['a@b c.ru', false, 'пробел в части домена до точки'],
    ['a@b.c d', false, 'пробел после точки'],
    ['a@b@c.ru', false, 'второй @ в домене до точки'],
    ['a@b.c@d', false, 'второй @ после точки'],
    ['+79991234567', false, 'телефон — точно не email'],
  ])('%s → email передан=%s (%s)', async (contact, expectEmail) => {
    const args = await bookWithContact(contact);
    if (expectEmail) expect(args.email).toBe(contact);
    else expect(args.email).toBeUndefined();
  });
});

describe('BookingService.book — полный объект payment-URL', () => {
  it('successUrl/failUrl строятся от siteUrl без двойного слэша (SITE_URL с хвостовым /)', async () => {
    const args = await bookWithContact('a@b.ru', 'https://example.com/');
    expect(args.successUrl).toBe('https://example.com/api/payment/success');
    expect(args.failUrl).toBe('https://example.com/api/payment/fail');
  });

  it('SITE_URL не задан → дефолтный домен kotlarewski.gr', async () => {
    const args = await bookWithContact('a@b.ru', undefined);
    expect(args.successUrl).toBe('https://kotlarewski.gr/api/payment/success');
    expect(args.failUrl).toBe('https://kotlarewski.gr/api/payment/fail');
  });

  it('desc содержит дату/время сессии в МСК и суффикс "МСК" (не пустая строка)', async () => {
    const args = await bookWithContact('a@b.ru');
    const expectedDate = new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Moscow',
    }).format(INSIDE_WINDOW);
    expect(args.desc).toBe(`Психологическая сессия ${expectedDate} МСК`);
  });

  it('invId в payment-URL равен id созданной брони', async () => {
    const args = await bookWithContact('a@b.ru');
    expect(args.invId).toBe(100); // первый id из фейкового tx.booking.create
  });

  it('amount берётся из pricing.getPrice, а не хардкодится', async () => {
    const args = await bookWithContact('a@b.ru');
    expect(args.amount).toBe(4000);
  });
});

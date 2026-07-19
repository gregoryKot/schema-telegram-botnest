// Security: capability-token эндпоинты не утекают PII (security-таск
// 2026-07-17). booking/subscription отдают статус по /by-token/:token —
// токен = единственная аутентификация (unguessable capability URL).
// Риск: если сервис вернёт всю строку (return row) вместо явного allowlist,
// протечёт PII (имя/контакт/email/telegramId) и шифрованные поля тому, у
// кого просто есть ссылка. Инвариант: ответ — строгий allowlist без PII.
// Плюс: cancelToken генерируется randomUUID (122 бита), не Math.random.
import { readFileSync } from 'fs';
import { join } from 'path';
import { BookingService } from '../booking/booking.service';
import { SubscriptionService } from '../subscription/subscription.service';

const PII_KEYS = [
  'name',
  'contact',
  'email',
  'phone',
  'telegramId',
  'cancelToken',
  'userId',
  'clientEmail',
];

function config(map: Record<string, string> = {}) {
  return {
    get: (k: string) => map[k],
    getOrThrow: (k: string) => map[k],
  } as any;
}

describe('booking getPublicByToken — без PII', () => {
  it('возвращает только allowlist статуса, ни одного PII-поля', async () => {
    const row = {
      id: 1,
      status: 'CONFIRMED',
      type: 'consult',
      startsAt: new Date('2026-08-01T10:00:00Z'),
      durationMin: 60,
      meetingUrl: 'https://meet/x',
      // PII, которые НЕ должны утечь:
      name: 'Иван Тайный',
      contact: '+79990001122',
      cancelToken: 'secret-token',
      clientEmail: 'ivan@example.com',
    };
    const prisma = {
      booking: { findUnique: jest.fn().mockResolvedValue(row) },
    } as any;
    const svc = new BookingService(
      prisma,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      config(),
    );
    const res = (await svc.getPublicByToken('secret-token')) as Record<
      string,
      unknown
    >;
    for (const k of PII_KEYS) expect(res[k]).toBeUndefined();
    expect(res.status).toBe('CONFIRMED');
  });

  it('нет брони по токену → NotFound (не молчит, не отдаёт чужое)', async () => {
    const prisma = {
      booking: { findUnique: jest.fn().mockResolvedValue(null) },
    } as any;
    const svc = new BookingService(
      prisma,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      config(),
    );
    await expect(svc.getPublicByToken('nope')).rejects.toThrow();
  });
});

describe('subscription getPublicByToken — без PII', () => {
  it('возвращает только статус/период/сумму/дату, ни одного PII-поля', async () => {
    const row = {
      id: 1,
      status: 'active',
      period: 'month',
      amount: 500,
      nextChargeAt: new Date('2026-09-01T00:00:00Z'),
      telegramId: 123456n,
      cancelToken: 'secret',
      email: 'x@y.z',
    };
    const prisma = {
      subscription: { findUnique: jest.fn().mockResolvedValue(row) },
    } as any;
    const svc = new SubscriptionService(
      prisma,
      {} as any,
      {} as any,
      config({ SUBSCRIPTION_ENABLED: 'true' }),
    );
    const res = (await svc.getPublicByToken('secret')) as Record<
      string,
      unknown
    >;
    for (const k of PII_KEYS) expect(res[k]).toBeUndefined();
    expect(res.status).toBe('active');
    expect(res.amount).toBe(500);
  });
});

describe('трипваер: cancelToken — крипто-стойкая генерация', () => {
  it.each([
    'booking/booking.service.ts',
    'subscription/subscription.service.ts',
  ])('%s: cancelToken = randomUUID(), не Math.random', (rel) => {
    const src = readFileSync(join(__dirname, '..', rel), 'utf8');
    expect(src).toMatch(/cancelToken\s*=\s*randomUUID\(\)/);
    expect(src).not.toMatch(/cancelToken\s*=\s*[^;]*Math\.random/);
  });
});

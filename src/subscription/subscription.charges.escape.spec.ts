// Карточка оплаченной подписки владельцу: Telegram — без email и Telegram ID
// подписчика (152-ФЗ), письмо — с ними; email экранирован (M1, аудит 2026-10).
import { markChargePaid } from './subscription.charges';
import { SUBSCRIPTION_INVID_BASE } from './subscription.constants';
import { PII, expectNoMarkers } from '../test-support/pii-markers';
import type { OwnerNotice } from '../utils/owner-card';

async function paid(email: string, telegramId: bigint | null = null) {
  const sub = {
    id: 1,
    period: 'month',
    amount: 300,
    email,
    telegramId,
  };
  const prisma: any = {
    subscriptionCharge: {
      findUnique: jest.fn(async () => ({
        id: 5,
        subscriptionId: 1,
        amount: 300,
        status: 'pending',
        isFirst: true,
      })),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
    subscription: {
      findUnique: jest.fn(async () => sub),
      update: jest.fn(async () => sub),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
  };
  prisma.$transaction = jest.fn(async (fn: any) => fn(prisma));
  const notify = {
    alertAdmin: jest.fn(async () => undefined),
    notifyAdminBoth: jest.fn(async (_h: OwnerNotice, _s: string) => undefined),
  };
  const deps: any = {
    prisma,
    robokassa: { enabled: true },
    notify,
    logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
    enabled: true,
  };
  await markChargePaid(deps, SUBSCRIPTION_INVID_BASE + 5, 300);
  expect(notify.alertAdmin).not.toHaveBeenCalled();
  expect(notify.notifyAdminBoth).toHaveBeenCalledTimes(1);
  return notify.notifyAdminBoth.mock.calls[0];
}

describe('markChargePaid — карточка оплаченной подписки владельцу', () => {
  it('email и Telegram ID из маркеров: в Telegram ни одного, в письме — оба', async () => {
    const [html, subject] = await paid(PII.email, PII.telegramId);
    expectNoMarkers(html.telegram);
    expect(html.telegram).toContain('<b>Новая подписка #1</b> 300 ₽/мес');
    expect(html.telegram).toContain('Платёж #5 — оплачен');
    expect(html.telegram).toContain('в письме на почте');
    expect(html.email).toContain(PII.email);
    expect(html.email).toContain(`tg:${PII.telegramId}`);
    expect(subject).toBe('Новая подписка #1 300 ₽/мес');
  });

  it('email с HTML не доходит до письма сырым (M1)', async () => {
    const [html] = await paid('<a href="https://evil/">x</a>');
    expect(html.email).not.toContain('<a href');
    expect(html.email).toContain('&lt;a href="https://evil/"&gt;x&lt;/a&gt;');
  });
});

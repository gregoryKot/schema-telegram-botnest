// M1 (аудит 2026-10): email подписчика уходит админу в HTML-сообщении
// (parse_mode HTML) — должен быть экранирован.
import { markChargePaid } from './subscription.charges';
import { SUBSCRIPTION_INVID_BASE } from './subscription.constants';

describe('markChargePaid — экранирование email в алерте админу (M1)', () => {
  it('email с HTML не доходит до DM сырым', async () => {
    const evil = '<a href="https://evil/">x</a>';
    const sub = {
      id: 1,
      period: 'month',
      amount: 300,
      email: evil,
      telegramId: null,
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
      },
    };
    const notify = { alertAdmin: jest.fn(async () => undefined) };
    const deps: any = {
      prisma,
      robokassa: { enabled: true },
      notify,
      logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
      enabled: true,
    };
    await markChargePaid(deps, SUBSCRIPTION_INVID_BASE + 5, 300);
    const text = notify.alertAdmin.mock.calls[0][0] as string;
    expect(text).not.toContain('<a href');
    expect(text).toContain('&lt;a href="https://evil/"&gt;x&lt;/a&gt;');
    expect(text).toContain('<b>Новая подписка</b>');
  });
});

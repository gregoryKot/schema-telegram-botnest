// Просроченное продление (R8): выборка просроченных — снимок, а до пометки
// failed строку мог изменить вебхук или второй обработчик. Пометка — CAS только
// из pending: оплату в сбой не превращает, сбой дважды не засчитывает.
import {
  expireStaleCharges,
  WEBHOOK_WAIT_MS,
} from './subscription.charge-guards';
import { subscriptionUpdateMany } from '../test-support/subscription-update-many';

const NOW = Date.parse('2026-12-02T10:00:00Z');

/** `statusNow` — что лежит в строке charge к моменту пометки. */
function world(stale: { id: number; subId: number; statusNow: string }[]) {
  const rows = new Map(stale.map((c) => [c.id, { status: c.statusNow }]));
  const subs = new Map<number, any>([
    [1, { id: 1, status: 'active', failedAttempts: 0, nextChargeAt: null }],
  ]);
  const prisma: any = {
    subscriptionCharge: {
      findMany: jest.fn(async () =>
        stale.map((c) => ({
          id: c.id,
          subscriptionId: c.subId,
          status: 'pending',
          isFirst: false,
          createdAt: new Date(NOW - WEBHOOK_WAIT_MS - 60_000),
        })),
      ),
      updateMany: jest.fn(async ({ where, data }: any) => {
        const row = rows.get(where.id);
        const st = where.status;
        const hit =
          row &&
          (typeof st === 'string' ? row.status === st : row.status !== st.not);
        if (!hit) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      }),
    },
    subscription: {
      findUnique: jest.fn(async ({ where }: any) => subs.get(where.id) ?? null),
      updateMany: subscriptionUpdateMany(subs),
    },
  };
  prisma.$transaction = jest.fn(async (fn: any) => fn(prisma));
  const notify = { alertAdmin: jest.fn(async () => undefined) };
  const run = () =>
    expireStaleCharges({ prisma, notify, logger: { log: jest.fn() } }, 3, NOW);
  return { rows, subs, notify, run };
}

describe('expireStaleCharges — строка изменилась после выборки', () => {
  it('вебхук успел подтвердить оплату — charge paid, сбой не засчитан, алерта нет', async () => {
    const w = world([{ id: 5, subId: 1, statusNow: 'paid' }]);
    await w.run();
    expect(w.rows.get(5)!.status).toBe('paid');
    expect(w.subs.get(1).failedAttempts).toBe(0);
    expect(w.notify.alertAdmin).not.toHaveBeenCalled();
  });

  it('сбой уже засчитал второй обработчик — повторно не считается', async () => {
    const w = world([{ id: 5, subId: 1, statusNow: 'failed' }]);
    w.subs.get(1).failedAttempts = 1;
    await w.run();
    expect(w.subs.get(1).failedAttempts).toBe(1);
    expect(w.notify.alertAdmin).not.toHaveBeenCalled();
  });

  it('подписки уже нет — просрочка пропускается, следующая закрывается', async () => {
    const w = world([
      { id: 4, subId: 99, statusNow: 'pending' },
      { id: 5, subId: 1, statusNow: 'pending' },
    ]);
    await w.run();
    expect(w.rows.get(4)!.status).toBe('pending');
    expect(w.rows.get(5)!.status).toBe('failed');
    expect(w.subs.get(1).failedAttempts).toBe(1);
    expect(w.notify.alertAdmin).toHaveBeenCalledTimes(1);
  });
});

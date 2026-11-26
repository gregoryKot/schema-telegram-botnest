// Аудит 2026-11, R8 (подписка выключена флагом, чиним до включения):
//  - `OK` от /Merchant/Recurring считался списанием: charge висел pending без
//    вебхука, подписка оставалась active на период без оплаты, никто не знал;
//  - таймаут ответа Robokassa → failed → повтор через сутки, а P-3 смотрел
//    только pending: если списание по таймауту всё же прошло, повтор списывал
//    второй раз.
// Стейтфул-фейк Prisma: время двигают фейковые таймеры, вебхук — markChargePaid.
import { Logger } from '@nestjs/common';
import { chargeDue, markChargePaid } from './subscription.charges';
import { SUBSCRIPTION_INVID_BASE } from './subscription.constants';
import { subscriptionUpdateMany } from '../test-support/subscription-update-many';

const HOUR = 3_600_000;
const T0 = Date.parse('2026-12-01T10:00:00Z');

function matchStatus(row: { status: string }, st: unknown): boolean {
  if (st === undefined) return true;
  if (typeof st === 'string') return row.status === st;
  const s = st as { in?: string[]; not?: string };
  if (s.in) return s.in.includes(row.status);
  if (s.not !== undefined) return row.status !== s.not;
  return true;
}

function makeWorld(chargeResults: { ok: boolean; body: string }[]) {
  const subs = new Map<number, any>();
  const charges = new Map<number, any>();
  let nextChargeId = 1;
  subs.set(1, {
    id: 1,
    status: 'active',
    period: 'month',
    amount: 500,
    email: null,
    telegramId: null,
    firstInvId: 900001,
    failedAttempts: 0,
    nextChargeAt: new Date(T0 - 1000),
  });
  const prisma: any = {
    subscription: {
      findMany: jest.fn(async ({ where }: any) =>
        [...subs.values()].filter(
          (s) =>
            where.status.in.includes(s.status) &&
            s.nextChargeAt != null &&
            s.nextChargeAt <= where.nextChargeAt.lte,
        ),
      ),
      findUnique: jest.fn(async ({ where }: any) => subs.get(where.id) ?? null),
      updateMany: subscriptionUpdateMany(subs),
    },
    $executeRaw: jest.fn(
      async (_sql: TemplateStringsArray, ...values: unknown[]) => {
        const [nextAt, id, notAfter] = values as [Date, number, Date];
        const row = subs.get(id);
        if (!row?.nextChargeAt || row.nextChargeAt > notAfter) return 0;
        row.nextChargeAt = nextAt;
        return 1;
      },
    ),
    subscriptionCharge: {
      create: jest.fn(async ({ data }: any) => {
        const row = {
          id: nextChargeId++,
          status: 'pending',
          isFirst: false,
          createdAt: new Date(),
          ...data,
        };
        charges.set(row.id, row);
        return row;
      }),
      findUnique: jest.fn(
        async ({ where }: any) => charges.get(where.id) ?? null,
      ),
      findFirst: jest.fn(
        async ({ where }: any) =>
          [...charges.values()]
            .filter(
              (c) =>
                c.subscriptionId === where.subscriptionId &&
                matchStatus(c, where.status) &&
                c.createdAt >= where.createdAt.gte,
            )
            .sort((a, b) => b.createdAt - a.createdAt)[0] ?? null,
      ),
      findMany: jest.fn(async ({ where }: any) =>
        [...charges.values()].filter(
          (c) =>
            matchStatus(c, where.status) &&
            c.isFirst === where.isFirst &&
            c.createdAt < where.createdAt.lt,
        ),
      ),
      updateMany: jest.fn(async ({ where, data }: any) => {
        const row = charges.get(where.id);
        if (!row || !matchStatus(row, where.status)) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      }),
    },
    $transaction: jest.fn(async (fn: any) => fn(prisma)),
  };
  const robokassa = {
    enabled: true,
    chargeRecurring: jest.fn(async () => chargeResults.shift()!),
  };
  const notify = {
    alertAdmin: jest.fn(async () => undefined),
    notifyAdminBoth: jest.fn(async () => undefined),
  };
  const logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
  const deps = {
    prisma,
    robokassa: robokassa as never,
    notify: notify as never,
    logger: logger as unknown as Logger,
    enabled: true,
  };
  const at = async (ms: number) => {
    jest.setSystemTime(ms);
    await chargeDue(deps);
  };
  const alerts = () => notify.alertAdmin.mock.calls.map((c) => String(c[0]));
  return { subs, charges, robokassa, deps, at, alerts };
}

beforeEach(() => {
  jest.useFakeTimers({
    doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'],
  });
  jest.setSystemTime(T0);
});
afterEach(() => jest.useRealTimers());

describe('R8: таймаут ответа Robokassa', () => {
  it('failed по таймауту не повторяется раньше 48 часов от попытки', async () => {
    const w = makeWorld([
      { ok: false, body: 'The operation was aborted due to timeout' },
      { ok: true, body: 'OK2000000002' },
    ]);
    await w.at(T0);
    expect(w.charges.get(1).status).toBe('failed');
    // Сбой поставил повтор «через сутки» — подписка снова должник…
    expect(w.subs.get(1).nextChargeAt.getTime()).toBe(T0 + 24 * HOUR);
    // …но P-3 не даёт списать: попытка моложе 48 часов могла пройти.
    for (const h of [24, 30, 47]) await w.at(T0 + h * HOUR);
    expect(w.robokassa.chargeRecurring).toHaveBeenCalledTimes(1);
    // Свежий failed — ожидаемая пауза, не повод будить владельца каждый час.
    expect(w.alerts().filter((a) => a.includes('pending-charge'))).toEqual([]);
    // КОНТРОЛЬ: после окна повтор уходит.
    await w.at(T0 + 49 * HOUR);
    expect(w.robokassa.chargeRecurring).toHaveBeenCalledTimes(2);
  });
});

describe('R8: «запрос принят» без вебхука', () => {
  it('через сутки без вебхука — неудача с алертом, нового списания в этот тик нет', async () => {
    const w = makeWorld([{ ok: true, body: 'OK2000000001' }]);
    await w.at(T0);
    expect(w.charges.get(1).status).toBe('pending'); // OK — не списание
    await w.at(T0 + 23 * HOUR);
    expect(w.charges.get(1).status).toBe('pending');
    expect(w.alerts()).toEqual([]);

    await w.at(T0 + 25 * HOUR);
    expect(w.charges.get(1).status).toBe('failed');
    expect(w.subs.get(1).failedAttempts).toBe(1);
    expect(w.robokassa.chargeRecurring).toHaveBeenCalledTimes(1);
    const [alert] = w.alerts();
    expect(alert).toContain('Подписка #1: списание #1 не подтвердилось');
    expect(alert).toContain('(1/3)');
  });

  it('поздний вебхук после таймаута засчитывает оплату — повтора не будет', async () => {
    const w = makeWorld([{ ok: true, body: 'OK2000000001' }]);
    await w.at(T0);
    await w.at(T0 + 25 * HOUR); // просрочено → failed
    jest.setSystemTime(T0 + 30 * HOUR);
    await markChargePaid(w.deps, SUBSCRIPTION_INVID_BASE + 1, 500);
    expect(w.charges.get(1).status).toBe('paid');
    expect(w.subs.get(1).failedAttempts).toBe(0);
    for (const h of [49, 72, 24 * 20]) await w.at(T0 + h * HOUR);
    expect(w.robokassa.chargeRecurring).toHaveBeenCalledTimes(1);
  });

  it('вебхук пришёл вовремя — просрочки нет, алерта нет', async () => {
    const w = makeWorld([{ ok: true, body: 'OK2000000001' }]);
    await w.at(T0);
    jest.setSystemTime(T0 + HOUR);
    await markChargePaid(w.deps, SUBSCRIPTION_INVID_BASE + 1, 500);
    await w.at(T0 + 30 * HOUR);
    expect(w.charges.get(1).status).toBe('paid');
    expect(w.alerts().some((a) => a.includes('не подтвердилось'))).toBe(false);
  });

  it('КОНТРОЛЬ: брошенная первая оплата (isFirst) не считается неудачей продления', async () => {
    const w = makeWorld([]);
    w.subs.get(1).nextChargeAt = null;
    w.charges.set(9, {
      id: 9,
      subscriptionId: 1,
      amount: 500,
      status: 'pending',
      isFirst: true,
      createdAt: new Date(T0 - 72 * HOUR),
    });
    await w.at(T0);
    expect(w.charges.get(9).status).toBe('pending');
    expect(w.alerts()).toEqual([]);
  });
});

describe('R8: P-3 и свежий pending', () => {
  it('КОНТРОЛЬ: pending моложе 48 часов по-прежнему блокирует и алертит', async () => {
    const w = makeWorld([]);
    w.charges.set(5, {
      id: 5,
      subscriptionId: 1,
      amount: 500,
      status: 'pending',
      isFirst: false,
      createdAt: new Date(T0 - HOUR),
    });
    await w.at(T0);
    expect(w.robokassa.chargeRecurring).not.toHaveBeenCalled();
    expect(w.alerts()[0]).toContain('pending-charge #5');
  });
});

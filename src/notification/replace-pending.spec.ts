// Хвост E16: «снять + поставить» — одна транзакция, лок перепланировки берётся
// первым. Что Postgres держит лок и UPDATE после него видит чужой коммит —
// test/raw-sql-live-infra.e2e-spec.ts (мок этого не докажет, правило №18).
import { Prisma } from '@prisma/client';
import { replacePending, swapReminder } from './replace-pending';
import type { PrismaService } from '../prisma/prisma.service';

/** standIns — сколько перерывов/сводок уже стоит у человека; openPlans —
 *  сколько неотмеченных планов на проверяемый день. */
function fakeDb(standIns = 0, openPlans = 1) {
  const steps: string[] = [];
  const tx = {
    $executeRaw: jest.fn((sql: TemplateStringsArray, ...args: unknown[]) => {
      steps.push(`lock ${sql.join('?')} ${String(args[0])}`);
      return Promise.resolve(0);
    }),
    scheduledNotification: {
      updateMany: jest.fn(async () => {
        steps.push('cancel');
        return { count: 1 };
      }),
      create: jest.fn(async () => {
        steps.push('create');
        return {};
      }),
      count: jest.fn(async () => {
        steps.push('check');
        return standIns;
      }),
    },
    practicePlan: {
      count: jest.fn(async () => {
        steps.push('plan');
        return openPlans;
      }),
    },
  };
  const prisma = {
    $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) => {
      steps.push('begin');
      await fn(tx);
      steps.push('commit');
    }),
  };
  return { prisma: prisma as unknown as PrismaService, tx, steps };
}

describe('replacePending — снять и поставить под локом на человека', () => {
  it('лок, снятие и вставка — внутри одной транзакции, лок первым', async () => {
    const { prisma, steps } = fakeDb();
    await replacePending(prisma, 42n, 'reminder', new Date(0));
    expect(steps).toEqual([
      'begin',
      'lock SELECT pg_advisory_xact_lock(hashtext(?)) reschedule:42',
      'cancel',
      'check',
      'create',
      'commit',
    ]);
  });

  // Хвост волны 8: правка настроек решила «ставить напоминание» до лока, а
  // обход за это время поставил вместо него перерыв — второго не ставим.
  it('перерыв или сводка уже стоят — напоминание не ставится', async () => {
    jest.useFakeTimers({ now: new Date('2026-11-08T21:00:00Z') });
    const { prisma, tx, steps } = fakeDb(1);
    await replacePending(prisma, 42n, 'reminder', new Date(0));
    expect(steps).toEqual([
      'begin',
      'lock SELECT pg_advisory_xact_lock(hashtext(?)) reschedule:42',
      'cancel',
      'check',
      'commit',
    ]);
    expect(tx.scheduledNotification.count).toHaveBeenCalledWith({
      where: {
        userId: 42n,
        type: {
          in: [
            'lapsing_3',
            'dormant_7',
            'value_recap',
            'reengagement_30',
            'nudge',
            'weekly',
            'donate_reminder',
            'practice_missed',
            'low_streak_insight',
          ],
        },
        sentAt: null,
        cancelledAt: null,
        // Просроченный дольше часа заменитель — хвост прошлого дня, не блокирует.
        sendAt: { gte: new Date('2026-11-08T20:00:00Z') },
      },
    });
    jest.useRealTimers();
  });

  it('другие типы перерыв не проверяют — меняются как раньше', async () => {
    const { prisma, steps } = fakeDb(1);
    await replacePending(prisma, 42n, 'practice_reminder', new Date(0));
    expect(steps).toContain('create');
    expect(steps).not.toContain('check');
  });

  it('снимает только неотправленные этого человека и типа; payload шифруется как в schedule', async () => {
    const { prisma, tx } = fakeDb();
    const at = new Date('2026-07-02T18:00:00Z');
    await replacePending(prisma, 42n, 'reminder', at, { streak: 3 });
    expect(tx.scheduledNotification.updateMany).toHaveBeenCalledWith({
      where: { userId: 42n, type: 'reminder', sentAt: null, cancelledAt: null },
      data: { cancelledAt: expect.any(Date), payload: Prisma.DbNull },
    });
    expect(tx.scheduledNotification.create).toHaveBeenCalledWith({
      data: {
        userId: 42n,
        type: 'reminder',
        sendAt: at,
        payload: expect.any(String),
      },
    });
  });

  it('у разных людей — разные ключи лока', async () => {
    const a = fakeDb();
    const b = fakeDb();
    await replacePending(a.prisma, 1n, 'reminder', new Date(0));
    await replacePending(b.prisma, 2n, 'reminder', new Date(0));
    expect(a.tx.$executeRaw.mock.calls[0][1]).toBe('reschedule:1');
    expect(b.tx.$executeRaw.mock.calls[0][1]).toBe('reschedule:2');
  });
});

describe('swapReminder — перерыв или сводка вместо напоминания', () => {
  it('снять напоминание и поставить сообщение дня — одна транзакция под тем же локом', async () => {
    const { prisma, tx, steps } = fakeDb();
    const at = new Date('2026-07-02T18:00:00Z');
    await swapReminder(prisma, 42n, 'lapsing_3', at);
    expect(steps).toEqual([
      'begin',
      'lock SELECT pg_advisory_xact_lock(hashtext(?)) reschedule:42',
      'cancel',
      'create',
      'commit',
    ]);
    expect(tx.scheduledNotification.updateMany).toHaveBeenCalledWith({
      where: { userId: 42n, type: 'reminder', sentAt: null, cancelledAt: null },
      data: { cancelledAt: expect.any(Date), payload: Prisma.DbNull },
    });
    expect(tx.scheduledNotification.create).toHaveBeenCalledWith({
      data: { userId: 42n, type: 'lapsing_3', sendAt: at, payload: undefined },
    });
  });
});

// Хвост волны 9: «такое уже стоит» спрашивали до лока, и два обхода разом
// (ручной запуск вместе с полуночным) ставили по сообщению одного типа.
describe('swapReminder с проверкой под локом (SwapGuard)', () => {
  const LOCK = 'lock SELECT pg_advisory_xact_lock(hashtext(?)) reschedule:42';

  it('такое уже стоит — напоминание не снимается, второго нет', async () => {
    const { prisma, tx, steps } = fakeDb(1);
    await swapReminder(prisma, 42n, 'weekly', new Date(0), undefined, {
      unlessPending: true,
    });
    expect(steps).toEqual(['begin', LOCK, 'check', 'commit']);
    expect(tx.scheduledNotification.count).toHaveBeenCalledWith({
      where: { userId: 42n, type: 'weekly', sentAt: null, cancelledAt: null },
    });
  });

  it('такого нет — проверка, снятие и вставка в одной транзакции', async () => {
    const { prisma, steps } = fakeDb(0);
    await swapReminder(prisma, 42n, 'weekly', new Date(0), undefined, {
      unlessPending: true,
    });
    expect(steps).toEqual([
      'begin',
      LOCK,
      'check',
      'cancel',
      'create',
      'commit',
    ]);
  });

  it('план дня уже отмечен — вопроса о нём нет', async () => {
    const { prisma, tx, steps } = fakeDb(0, 0);
    await swapReminder(prisma, 42n, 'practice_missed', new Date(0), undefined, {
      openPlanDay: '2026-11-06',
    });
    expect(steps).toEqual(['begin', LOCK, 'plan', 'commit']);
    expect(tx.practicePlan.count).toHaveBeenCalledWith({
      where: { userId: 42n, scheduledDate: '2026-11-06', done: null },
    });
  });

  it('план не отмечен — вопрос встаёт', async () => {
    const { prisma, steps } = fakeDb(0, 1);
    await swapReminder(prisma, 42n, 'practice_missed', new Date(0), undefined, {
      openPlanDay: '2026-11-06',
    });
    expect(steps).toEqual([
      'begin',
      LOCK,
      'plan',
      'cancel',
      'create',
      'commit',
    ]);
  });
});

/** База в памяти: транзакции идут строго по очереди, как под локом на
 *  человека; что Postgres держит лок — test/notify-stand-in-race.e2e-spec.ts. */
function serialDb() {
  const rows: { type: string; cancelled: boolean }[] = [];
  const io = () => new Promise((r) => setImmediate(r));
  const live = (type: string) =>
    rows.filter((r) => !r.cancelled && r.type === type);
  const tx = {
    $executeRaw: async () => 0,
    scheduledNotification: {
      count: async ({ where }: { where: { type: string } }) => {
        await io();
        return live(where.type).length;
      },
      updateMany: async ({ where }: { where: { type: string } }) => {
        await io();
        for (const r of live(where.type)) r.cancelled = true;
      },
      create: async ({ data }: { data: { type: string } }) => {
        await io();
        rows.push({ type: data.type, cancelled: false });
      },
    },
  };
  let queue = Promise.resolve();
  const prisma = {
    $transaction: (job: (t: typeof tx) => Promise<void>) => {
      const run = queue.then(() => job(tx));
      queue = run.catch(() => undefined);
      return run;
    },
  } as unknown as PrismaService;
  return { prisma, live };
}

describe('два обхода разом — сообщение дня одно', () => {
  const at = new Date('2026-11-06T18:00:00Z');

  it.each(['lapsing_3', 'weekly', 'donate_reminder'] as const)(
    '%s: два одновременных вызова с проверкой → одна строка',
    async (type) => {
      const { prisma, live } = serialDb();
      await Promise.all([
        swapReminder(prisma, 1n, type, at, undefined, { unlessPending: true }),
        swapReminder(prisma, 1n, type, at, undefined, { unlessPending: true }),
      ]);
      expect(live(type)).toHaveLength(1);
    },
  );

  it('контроль: без проверки под локом — две строки', async () => {
    const { prisma, live } = serialDb();
    await Promise.all([
      swapReminder(prisma, 1n, 'lapsing_3', at),
      swapReminder(prisma, 1n, 'lapsing_3', at),
    ]);
    expect(live('lapsing_3')).toHaveLength(2);
  });
});

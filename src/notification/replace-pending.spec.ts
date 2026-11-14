// Хвост E16: «снять + поставить» — одна транзакция, лок перепланировки берётся
// первым. Что Postgres держит лок и UPDATE после него видит чужой коммит —
// test/raw-sql-live-infra.e2e-spec.ts (мок этого не докажет, правило №18).
import { Prisma } from '@prisma/client';
import { replacePending, swapReminder } from './replace-pending';
import type { PrismaService } from '../prisma/prisma.service';

/** standIns — сколько перерывов/сводок уже стоит у человека. */
function fakeDb(standIns = 0) {
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

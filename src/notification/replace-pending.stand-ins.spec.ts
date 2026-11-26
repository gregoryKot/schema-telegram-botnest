// Хвост волны 9: донат 1-го числа, невыполненный план и инсайт о низкой
// потребности ставились planDay мимо замены напоминания (schedule), и правка
// настроек, решившая «ставить напоминание» до обхода, оставляла его рядом с
// ними — два проактивных в дне. Теперь они в REMINDER_STAND_INS и ставятся
// через swapReminder. Гонка «правка настроек ↔ обход» здесь — на базе в памяти
// с тем же порядком, что держит advisory-лок (транзакции по очереди); что
// Postgres держит лок, доказывает test/raw-sql-live-infra.e2e-spec.ts.
import { replacePending, swapReminder } from './replace-pending';
import type { PrismaService } from '../prisma/prisma.service';

type Row = {
  userId: bigint;
  type: string;
  sendAt: Date;
  sentAt: Date | null;
  cancelledAt: Date | null;
};

/** База в памяти: транзакции идут строго по очереди, как под локом на человека. */
function serialDb() {
  const rows: Row[] = [];
  const live = (where: { type?: string | { in: string[] } }) =>
    rows.filter((r) => {
      if (r.sentAt || r.cancelledAt) return false;
      const t = where.type;
      return (
        t === undefined ||
        (typeof t === 'string' ? r.type === t : t.in.includes(r.type))
      );
    });
  const tx = {
    $executeRaw: async () => 0,
    scheduledNotification: {
      updateMany: async ({ where }: { where: { type: string } }) => {
        for (const r of live(where)) r.cancelledAt = new Date();
        return { count: 0 };
      },
      count: async ({ where }: { where: { type: { in: string[] } } }) =>
        live(where).length,
      create: async ({ data }: { data: Row }) => {
        rows.push({ ...data, sentAt: null, cancelledAt: null });
        return {};
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
  const pending = () => live({}).map((r) => r.type);
  return { prisma, pending };
}

const STAND_INS = [
  'donate_reminder',
  'practice_missed',
  'low_streak_insight',
] as const;
const AT = new Date(Date.now() + 3_600_000);

describe('донат, план и инсайт вместо напоминания: гонка правки настроек и обхода', () => {
  it.each(STAND_INS)(
    '%s: правка настроек раньше обхода — напоминание снято',
    async (type) => {
      const { prisma, pending } = serialDb();
      await replacePending(prisma, 1n, 'reminder', AT);
      await swapReminder(prisma, 1n, type, AT);
      expect(pending()).toEqual([type]);
    },
  );

  it.each(STAND_INS)(
    '%s: обход раньше правки настроек — напоминание не ставится',
    async (type) => {
      const { prisma, pending } = serialDb();
      await swapReminder(prisma, 1n, type, AT);
      await replacePending(prisma, 1n, 'reminder', AT);
      expect(pending()).toEqual([type]);
    },
  );

  it.each(STAND_INS)(
    '%s: одновременно — в дне одно проактивное',
    async (type) => {
      const { prisma, pending } = serialDb();
      await Promise.all([
        replacePending(prisma, 1n, 'reminder', AT),
        swapReminder(prisma, 1n, type, AT),
        replacePending(prisma, 1n, 'reminder', AT),
      ]);
      expect(pending()).toEqual([type]);
    },
  );

  it('контроль: тип вне списка (pair_activity) напоминание не блокирует', async () => {
    const { prisma, pending } = serialDb();
    await replacePending(prisma, 1n, 'pair_activity', AT);
    await replacePending(prisma, 1n, 'reminder', AT);
    expect(pending().sort()).toEqual(['pair_activity', 'reminder']);
  });
});

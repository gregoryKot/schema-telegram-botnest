// Хвост E16 (аудит 2026-11): перепланировка «снять, затем поставить» была
// защищена очередью только внутри процесса (per-key-queue.ts). Полуночный
// обход на одном инстансе и правка настроек на другом шли вперемешку —
// «снять, снять, поставить, поставить», — и человек получал два напоминания.
//
// Два планировщика без общей очереди (два инстанса) над одной очередью
// уведомлений. Лок базы смоделирован: замены одного человека идут по очереди,
// как под pg_advisory_xact_lock; что Postgres держит его по-настоящему —
// test/raw-sql-live-infra.e2e-spec.ts.
import { NotificationPlannerService } from './notification.planner.service';
import { NotificationService } from './notification.service';
import { PROACTIVE_TYPES } from './notification.types';

interface Row {
  type: string;
  sendAt: Date;
  cancelled: boolean;
}

function sharedQueue() {
  const rows: Row[] = [];
  const db = () => new Promise((r) => setImmediate(r));
  const pending = (type: string) =>
    rows.filter((r) => r.type === type && !r.cancelled);
  const cancel = async (_u: bigint, type: string) => {
    await db();
    for (const r of pending(type)) r.cancelled = true;
  };
  const schedule = async (_u: bigint, type: string, sendAt: Date) => {
    await db();
    rows.push({ type, sendAt, cancelled: false });
  };
  let lock: Promise<void> = Promise.resolve();
  const replacePending = (u: bigint, type: string, sendAt: Date) => {
    const run = lock.then(async () => {
      await cancel(u, type);
      await schedule(u, type, sendAt);
    });
    lock = run.catch(() => undefined);
    return run;
  };
  return { pending, svc: { cancel, schedule, replacePending } };
}

/** Отдельный инстанс: свой планировщик, своя память, общая база. */
const instance = (svc: object) =>
  new NotificationPlannerService(
    svc as never,
    { nextReminderSeq: async () => 1 } as never,
    { getNeeds: () => [] } as never,
    {
      getConsecutiveDays: async () => 0,
      getWeeklyStats: async () => [],
      getHistoryRatings: async () => [],
    } as never,
    {} as never,
  );

describe('перепланировка напоминания на двух инстансах (хвост E16)', () => {
  const NOW = new Date('2026-07-02T00:05:00Z');

  it('обход и правка настроек одновременно — в очереди одно напоминание', async () => {
    const queue = sharedQueue();
    const sweep = instance(queue.svc);
    const settings = instance(queue.svc);

    await Promise.all([
      sweep.scheduleReminder(1n, 21, 'Europe/Moscow', NOW),
      settings.scheduleReminder(1n, 9, 'Europe/Moscow', NOW),
    ]);

    expect(queue.pending('reminder')).toHaveLength(1);
  });

  it('выигрывает замена, пришедшая последней', async () => {
    const queue = sharedQueue();
    const sweep = instance(queue.svc);
    const settings = instance(queue.svc);

    await sweep.scheduleReminder(1n, 21, 'Europe/Moscow', NOW);
    await settings.scheduleReminder(1n, 9, 'Europe/Moscow', NOW);

    const [only] = queue.pending('reminder');
    expect(queue.pending('reminder')).toHaveLength(1);
    // 09:00 МСК = 06:00 UTC.
    expect(only.sendAt.getUTCHours()).toBe(6);
  });
});

// Хвост волны 8 (аудит 2026-11): ветки planDay, которые ставят вместо
// напоминания перерыв, value_recap или сводку, шли двумя запросами — «снять
// напоминание», «поставить перерыв». Правка настроек на другом инстансе между
// ними оставляла в дне напоминание рядом с перерывом.
//
// Здесь настоящие NotificationService и replace-pending.ts над общей базой в
// памяти; pg_advisory_xact_lock смоделирован очередью транзакций.
interface DbRow {
  type: string;
  cancelledAt: Date | null;
}
type Where = { type: string | { in: string[] } };

function sharedPostgres() {
  const rows: DbRow[] = [];
  let onWrite: (() => void) | null = null;
  const io = () => new Promise((r) => setImmediate(r));
  const live = ({ type }: Where) =>
    rows.filter(
      (r) =>
        !r.cancelledAt &&
        (typeof type === 'string' ? r.type === type : type.in.includes(r.type)),
    );
  const table = {
    updateMany: async ({ where, data }: { where: Where; data: DbRow }) => {
      const first = onWrite;
      onWrite = null;
      first?.();
      await io();
      for (const r of live(where)) r.cancelledAt = data.cancelledAt;
    },
    create: async ({ data }: { data: { type: string } }) => {
      await io();
      rows.push({ type: data.type, cancelledAt: null });
    },
    count: async ({ where }: { where: Where }) => {
      await io();
      return live(where).length;
    },
  };
  let queue: Promise<void> = Promise.resolve();
  const prisma = {
    scheduledNotification: table,
    $transaction: async (fn: (tx: object) => Promise<void>) => {
      let release = () => undefined as void;
      const lock = async () => {
        const prev = queue;
        queue = new Promise<void>((r) => (release = r));
        await prev;
      };
      try {
        await fn({ scheduledNotification: table, $executeRaw: lock });
      } finally {
        release();
      }
    },
  };
  const proactive = () =>
    rows
      .filter(
        (r) => !r.cancelledAt && PROACTIVE_TYPES.includes(r.type as never),
      )
      .map((r) => r.type);
  return {
    proactive,
    /** Инстанс: свой планировщик и сервис, общая база. */
    planner: () => planner(new NotificationService(prisma as never)),
    /** Колбэк на первую запись в базу — «соседний инстанс пришёл посреди». */
    onFirstWrite: (fn: () => void) => (onWrite = fn),
  };
}

const planner = (notifications: NotificationService) =>
  new NotificationPlannerService(
    notifications,
    {
      claimPlanDay: async () => true,
      expirePauseIfDue: async () => 'none',
      evaluate: async () => ({ remindToday: true }),
      nextReminderSeq: async () => 1,
    } as never,
    { getNeeds: () => [] } as never,
    {
      getDaysSinceLastFill: async () => 3, // третий день без записей
      getConsecutiveDays: async () => 0,
      getWeeklyStats: async () => [],
      getHistoryRatings: async () => [],
    } as never,
    {} as never,
  );

const lapsingUser = {
  id: 1n,
  notifyTimezone: 'Europe/Moscow',
  notifyLocalHour: 21,
  notifyReminderEnabled: true,
  notifyFrequency: 0,
  notifyAdaptiveLevel: 0,
  notifyIgnoredCount: 0,
  notifyNextRemindDate: null,
  notifySkipAckDate: null,
  notifyLastEvalDate: null,
  notifyPausedUntil: null,
};

describe('сообщение дня вместо напоминания на двух инстансах (хвост волны 8)', () => {
  const NOW = new Date('2026-07-02T00:05:00Z');

  it('правка настроек посреди замены напоминания перерывом — в дне одно проактивное', async () => {
    const db = sharedPostgres();
    const sweep = db.planner();
    const settings = db.planner();
    let edited: Promise<void> = Promise.resolve();
    db.onFirstWrite(() => {
      edited = settings.scheduleReminder(1n, 9, 'Europe/Moscow', NOW);
    });

    await sweep.planDay(lapsingUser, NOW);
    await edited;

    expect(db.proactive()).toEqual(['lapsing_3']);
  });

  it('решение о напоминании принято до обхода, применено после — второго нет', async () => {
    const db = sharedPostgres();
    await db.planner().planDay(lapsingUser, NOW);
    await db.planner().scheduleReminder(1n, 9, 'Europe/Moscow', NOW);
    expect(db.proactive()).toEqual(['lapsing_3']);
  });

  it('контроль: правка настроек раньше обхода — перерыв снимает её напоминание', async () => {
    const db = sharedPostgres();
    await db.planner().scheduleReminder(1n, 9, 'Europe/Moscow', NOW);
    expect(db.proactive()).toEqual(['reminder']);
    await db.planner().planDay(lapsingUser, NOW);
    expect(db.proactive()).toEqual(['lapsing_3']);
  });
});

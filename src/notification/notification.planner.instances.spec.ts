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

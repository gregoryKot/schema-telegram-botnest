import { NotifyQueueMetricsService } from './notify-queue-metrics.service';

const NOW = new Date('2026-10-16T12:00:00Z').getTime();
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000);

type Row = { meta: unknown; createdAt: Date };

/** Фейк Prisma: строки событий по имени, отложенные напоминания — счётчиками. */
function makeService(
  rows: Row[],
  snoozes: Array<{ meta: unknown }> = [],
  counts = { sent: 0, cancelled: 0 },
) {
  const findMany = jest.fn(async ({ where }: { where: { name: string } }) =>
    where.name === 'reminder_snoozed' ? snoozes : rows,
  );
  const count = jest.fn(async ({ where }: { where: { sentAt?: unknown } }) =>
    where.sentAt ? counts.sent : counts.cancelled,
  );
  const prisma = {
    analyticsEvent: { findMany },
    scheduledNotification: { count },
  } as never;
  return { service: new NotifyQueueMetricsService(prisma), findMany, count };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
});
afterEach(() => jest.useRealTimers());

describe('NotifyQueueMetricsService', () => {
  it('берёт только серверные строки события за неделю', async () => {
    const { service, findMany } = makeService([]);
    await service.getMetrics();
    expect(findMany).toHaveBeenCalledWith({
      where: {
        name: 'notify_queue_tick',
        userId: null,
        createdAt: { gte: new Date(NOW - 7 * 86_400_000) },
      },
      select: { meta: true, createdAt: true },
    });
  });

  it('суммирует сутки и неделю раздельно', async () => {
    const { service } = makeService([
      {
        meta: { sent: 10, transient: 1, unknown: 2, waited: 1, deferred: 5 },
        createdAt: hoursAgo(1),
      },
      {
        meta: { sent: 20, transient: 0, waited: 0, deferred: 0 },
        createdAt: hoursAgo(30),
      },
    ]);
    const m = await service.getMetrics();
    expect(m.day).toEqual({
      ticks: 1,
      sent: 10,
      pushed: 0,
      transient: 1,
      unknown: 2,
      waited: 1,
      deferred: 5,
    });
    expect(m.week).toEqual({
      ticks: 2,
      sent: 30,
      pushed: 0,
      transient: 1,
      unknown: 2,
      waited: 1,
      deferred: 5,
    });
  });

  it('мусор в meta (null, строки, минус) считается нулём, а не NaN', async () => {
    const { service } = makeService([
      { meta: null, createdAt: hoursAgo(1) },
      {
        meta: { sent: '5', transient: -2, unknown: '1', waited: Number.NaN },
        createdAt: hoursAgo(2),
      },
    ]);
    const m = await service.getMetrics();
    expect(m.day).toEqual({
      ticks: 2,
      sent: 0,
      pushed: 0,
      transient: 0,
      unknown: 0,
      waited: 0,
      deferred: 0,
    });
  });

  it('render на пустой базе — строка без нулей', async () => {
    const { service } = makeService([]);
    expect(await service.render()).toContain(
      'За неделю напоминаний из очереди не было.',
    );
  });
});

describe('NotifyQueueMetricsService — «Напомню через час»', () => {
  it('нажатия — только строки бота (с булевым quietShift), исход — по очереди', async () => {
    const { service, findMany, count } = makeService(
      [],
      [
        { meta: { quietShift: true } },
        { meta: { quietShift: false } },
        // POST /api/event: sanitizeMeta срезал meta — подделка не считается
        { meta: null },
        { meta: { quietShift: 'yes' } },
      ],
      { sent: 1, cancelled: 1 },
    );
    const m = await service.getMetrics();
    expect(m.snooze).toEqual({
      snoozed: 2,
      quietShift: 1,
      delivered: 1,
      cancelled: 1,
    });
    const since = new Date(NOW - 7 * 86_400_000);
    expect(findMany).toHaveBeenCalledWith({
      where: { name: 'reminder_snoozed', createdAt: { gte: since } },
      select: { meta: true },
    });
    // Окно по sendAt — индекс очереди; тип pre_reminder ставит только эта кнопка.
    expect(count).toHaveBeenCalledWith({
      where: {
        type: 'pre_reminder',
        sendAt: { gte: since },
        sentAt: { not: null },
      },
    });
    expect(count).toHaveBeenCalledWith({
      where: {
        type: 'pre_reminder',
        sendAt: { gte: since },
        cancelledAt: { not: null },
      },
    });
  });
});

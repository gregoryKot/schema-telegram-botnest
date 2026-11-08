// E13 (аудит 2026-11): обход идёт в 00:00 UTC, а у Владивостока это 10:00
// местного, у Нью-Йорка — 20:00 вчерашнего дня. Планировщик считал «днём
// плана» местный день на момент обхода, и напоминание на 08:00 (Владивосток)
// или 18:00 (Нью-Йорк) уходило на следующий местный день — вечерняя запись его
// снимала, воскресная сводка приходила в понедельник. Теперь день плана —
// день, на который выпадает час отправки (шапка NotificationPlannerService).
import {
  NotificationPlannerService,
  PlannerUser,
} from './notification.planner.service';
import { NotificationCadenceService } from './notification.cadence.service';
import { localDateString } from './notification.time';
import { localMinutesOfDay } from './tz-offset';

const VLADIVOSTOK = 'Asia/Vladivostok'; // +10
const NEW_YORK = 'America/New_York'; // летом −4
const MOSCOW = 'Europe/Moscow';

/** Полуночный обход 00:05 UTC указанного UTC-дня. */
const walk = (utcDay: string) => new Date(`${utcDay}T00:05:00Z`);

function makeUser(over: Partial<PlannerUser> = {}): PlannerUser {
  return {
    id: 42n,
    notifyTimezone: MOSCOW,
    notifyLocalHour: 21,
    notifyReminderEnabled: true,
    notifyFrequency: 0,
    notifyAdaptiveLevel: 0,
    notifyIgnoredCount: 0,
    notifyNextRemindDate: null,
    notifySkipAckDate: null,
    notifyLastEvalDate: null,
    notifyPausedUntil: null,
    ...over,
  };
}

function make(daysSince = 1) {
  const schedule = jest.fn().mockResolvedValue(undefined);
  const notifications = {
    schedule,
    cancel: jest.fn().mockResolvedValue(undefined),
    hasPending: jest.fn().mockResolvedValue(false),
    // «Снять + поставить» одной транзакцией (replace-pending.ts).
    replacePending: jest.fn(
      (u: bigint, t: string, at: Date, p?: object): Promise<unknown> =>
        schedule(u, t, at, p),
    ),
  };
  const cadence = {
    claimPlanDay: jest.fn().mockResolvedValue(true),
    expirePauseIfDue: jest.fn().mockResolvedValue('none'),
    evaluate: jest.fn().mockResolvedValue({ remindToday: true }),
    nextReminderSeq: jest.fn().mockResolvedValue(1),
  };
  const analytics = {
    getDaysSinceLastFill: jest.fn().mockResolvedValue(daysSince),
    getWeeklyStats: jest.fn().mockResolvedValue([]),
    getBestDayOfWeek: jest.fn().mockResolvedValue(null),
    getConsecutiveDays: jest.fn().mockResolvedValue(0),
    getHistoryRatings: jest.fn().mockResolvedValue([]),
    getLowStreakNeeds: jest.fn().mockResolvedValue([]),
    getTotalDaysFilled: jest.fn().mockResolvedValue(0),
    getProfileInsight: jest.fn().mockResolvedValue(null),
  };
  const botService = { getNeeds: jest.fn().mockReturnValue([]) };
  const practices = { getMissedPlans: jest.fn().mockResolvedValue([]) };
  const svc = new NotificationPlannerService(
    notifications as never,
    cadence as never,
    botService as never,
    analytics as never,
    practices as never,
  );
  const sent = () =>
    notifications.schedule.mock.calls.map((c: unknown[]) => ({
      type: c[1] as string,
      at: c[2] as Date,
    }));
  return { svc, cadence, sent };
}

describe('planDay: день плана — местный день отправки (E13)', () => {
  it.each([
    // tz, час, обход (UTC-день), день плана, момент отправки
    [VLADIVOSTOK, 8, '2026-07-02', '2026-07-03', '2026-07-02T22:00:00.000Z'],
    [NEW_YORK, 18, '2026-07-02', '2026-07-02', '2026-07-02T22:00:00.000Z'],
    [MOSCOW, 21, '2026-07-02', '2026-07-02', '2026-07-02T18:00:00.000Z'],
  ])(
    '%s, %d:00: обход %s планирует день %s, напоминание в тот же местный день',
    async (tz, hour, utcDay, planDate, at) => {
      const { svc, cadence, sent } = make();
      const user = makeUser({ notifyTimezone: tz, notifyLocalHour: hour });
      await svc.planDay(user, walk(utcDay));
      expect(cadence.claimPlanDay).toHaveBeenCalledWith(
        user,
        walk(utcDay),
        planDate,
      );
      expect(cadence.evaluate).toHaveBeenCalledWith(
        user,
        walk(utcDay),
        planDate,
      );
      const [reminder] = sent();
      expect(reminder.type).toBe('reminder');
      expect(reminder.at.toISOString()).toBe(at);
      expect(localDateString(tz, reminder.at)).toBe(planDate);
      expect(localMinutesOfDay(tz, reminder.at)).toBe(hour * 60);
    },
  );

  // 2026-07-04 — суббота, 2026-07-05 — воскресенье.
  it.each([
    [VLADIVOSTOK, 8, '2026-07-04', '2026-07-04T22:00:00.000Z'],
    [NEW_YORK, 18, '2026-07-05', '2026-07-05T22:00:00.000Z'],
  ])(
    '%s, %d:00: недельная сводка — в воскресенье местного (обход %s)',
    async (tz, hour, utcDay, at) => {
      const { svc, sent } = make();
      await svc.planDay(
        makeUser({ notifyTimezone: tz, notifyLocalHour: hour }),
        walk(utcDay),
      );
      expect(sent()).toEqual([{ type: 'weekly', at: new Date(at) }]);
      expect(
        new Date(at).toLocaleDateString('en-US', {
          timeZone: tz,
          weekday: 'long',
        }),
      ).toBe('Sunday');
    },
  );

  it('Владивосток: обход в 10:00 воскресенья не шлёт сводку в понедельник', async () => {
    const { svc, sent } = make();
    await svc.planDay(
      makeUser({ notifyTimezone: VLADIVOSTOK, notifyLocalHour: 8 }),
      walk('2026-07-05'),
    );
    expect(sent().map((s) => s.type)).toEqual(['reminder']);
  });

  it('Владивосток: просьба о донате — 1-го числа местного, а не 2-го', async () => {
    const { svc, sent } = make();
    await svc.planDay(
      makeUser({ notifyTimezone: VLADIVOSTOK, notifyLocalHour: 8 }),
      walk('2026-07-31'),
    );
    expect(sent()).toEqual([
      { type: 'donate_reminder', at: new Date('2026-07-31T22:00:00.000Z') },
    ]);
  });

  it('перерыв считается на день плана: 2 дня к обходу = 3 дня к утру отправки', async () => {
    const vlad = make(2);
    await vlad.svc.planDay(
      makeUser({ notifyTimezone: VLADIVOSTOK, notifyLocalHour: 8 }),
      walk('2026-07-02'),
    );
    expect(vlad.sent().map((s) => s.type)).toEqual(['lapsing_3']);
    // Москва: день плана — сегодняшний, перерыв не сдвигается.
    const msk = make(2);
    await msk.svc.planDay(makeUser(), walk('2026-07-02'));
    expect(msk.sent().map((s) => s.type)).toEqual(['reminder']);
  });
});

describe('NotificationCadenceService.evaluate с днём плана (E13)', () => {
  function cadence(lastReminder: Date | null, daysSince: number) {
    const prisma = { user: { update: jest.fn().mockResolvedValue({}) } };
    const svc = new NotificationCadenceService(
      prisma as never,
      { lastSentAt: jest.fn().mockResolvedValue(lastReminder) } as never,
      {
        getDaysSinceLastFill: jest.fn().mockResolvedValue(daysSince),
        getFillDaysInLast: jest.fn().mockResolvedValue(0),
      } as never,
    );
    const data = () => prisma.user.update.mock.calls[0][0].data;
    return { svc, data };
  }
  const vlad = { ...makeUser({ notifyTimezone: VLADIVOSTOK }) };

  it('день плана — завтрашний: решение и следующий контакт от него', async () => {
    const { svc, data } = cadence(null, 1);
    const res = await svc.evaluate(
      { ...vlad, notifyNextRemindDate: '2026-07-03' },
      walk('2026-07-02'),
      '2026-07-03',
    );
    expect(res.remindToday).toBe(true);
    expect(data().notifyLastEvalDate).toBe('2026-07-03');
    expect(data().notifyNextRemindDate).toBe('2026-07-04');
  });

  it('игнор — по последнему завершённому местному дню, а не по дню перед днём плана', async () => {
    // Напоминание ушло 1 июля в 08:00 Владивостока, записи не было; обход —
    // 2 июля в 10:00 местного, день плана — 3 июля.
    const sentJuly1 = new Date('2026-06-30T22:00:00Z');
    const ignored = cadence(sentJuly1, 2);
    await ignored.svc.evaluate(vlad, walk('2026-07-02'), '2026-07-03');
    expect(ignored.data().notifyIgnoredCount).toBe(1);
    // Напоминание 2 июля в 08:00 — день ещё идёт, запись может быть вечером.
    const sentJuly2 = new Date('2026-07-01T22:00:00Z');
    const pending = cadence(sentJuly2, 1);
    await pending.svc.evaluate(vlad, walk('2026-07-02'), '2026-07-03');
    expect(pending.data().notifyIgnoredCount).toBe(0);
  });
});

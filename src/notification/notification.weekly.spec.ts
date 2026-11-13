// Хвост волны 3: у поясов, где день плана — завтрашний (Владивосток +10,
// Магадан +11), обход в 00:00 UTC идёт в субботу утром: сводка недели ставится
// по дню плана (воскресенье), а «Вчера был план» не говорит о пятнице
// (notification.weekly.ts). Москва — контроль. Текст плана и оценки в очередь
// не кладутся (РКН, #1135).
import {
  NotificationPlannerService,
  type PlannerUser,
} from './notification.planner.service';
import { missedPlanWeekday } from './notification.weekly';

const VLADIVOSTOK = 'Asia/Vladivostok'; // +10
const MAGADAN = 'Asia/Magadan'; // +11
const MOSCOW = 'Europe/Moscow';
// 2026-11-06 — пятница, 07 — суббота, 08 — воскресенье.
const FRIDAY_WALK = new Date('2026-11-06T00:05:00Z');
const SATURDAY_WALK = new Date('2026-11-07T00:05:00Z');
const SUNDAY_WALK = new Date('2026-11-08T00:05:00Z');

function makeUser(over: Partial<PlannerUser>): PlannerUser {
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

function makePlanner(remindToday: boolean) {
  const swapReminder = jest.fn().mockResolvedValue(undefined);
  const notifications = {
    schedule: jest.fn().mockResolvedValue(undefined),
    hasPending: jest.fn().mockResolvedValue(false),
    replacePending: jest.fn().mockResolvedValue(undefined),
    swapReminder,
  };
  const cadence = {
    claimPlanDay: jest.fn().mockResolvedValue(true),
    expirePauseIfDue: jest.fn().mockResolvedValue('none'),
    evaluate: jest.fn().mockResolvedValue({ remindToday }),
    nextReminderSeq: jest.fn().mockResolvedValue(1),
  };
  const analytics = {
    getDaysSinceLastFill: jest.fn().mockResolvedValue(1),
    getWeeklyStats: jest.fn().mockResolvedValue([]),
    getBestDayOfWeek: jest.fn().mockResolvedValue(null),
    getLowStreakNeeds: jest.fn().mockResolvedValue([]),
    getTotalDaysFilled: jest.fn().mockResolvedValue(0),
  };
  const practices = {
    getMissedPlans: jest
      .fn()
      .mockResolvedValue([{ practiceText: 'Позвонить другу' }]),
  };
  const svc = new NotificationPlannerService(
    notifications as never,
    cadence as never,
    { getNeeds: () => [] } as never,
    analytics as never,
    practices as never,
  );
  return { svc, swapReminder, analytics, practices };
}

describe('сводка недели: окно — по дню плана человека', () => {
  it.each([
    [VLADIVOSTOK, 8, SATURDAY_WALK],
    [MAGADAN, 8, SATURDAY_WALK],
    [MOSCOW, 21, SUNDAY_WALK],
  ])(
    '%s, %d:00: неделя кончается воскресеньем — днём, когда сводка уйдёт',
    async (tz, hour, at) => {
      const { svc, swapReminder, analytics } = makePlanner(true);
      await svc.planDay(
        makeUser({ notifyTimezone: tz, notifyLocalHour: hour }),
        at,
      );
      // Сводка без payload: средние и тренды не считаются и в очередь не идут.
      expect(swapReminder.mock.calls.map((c) => [c[1], c[3]])).toEqual([
        ['weekly', undefined],
      ]);
      expect(analytics.getWeeklyStats).not.toHaveBeenCalled();
    },
  );
});

describe('невыполненный план: день назван своим именем', () => {
  // Пятничный обход: у Владивостока и Магадана день плана — суббота, а
  // последний завершённый местный день — четверг (позавчера для субботы).
  it.each([
    // tz, проверяемый день, как назван в сообщении
    [VLADIVOSTOK, '2026-11-05', 4], // четверг
    [MAGADAN, '2026-11-05', 4],
    [MOSCOW, '2026-11-05', undefined],
  ])(
    '%s: план за последний завершённый день %s → день недели %s',
    async (tz, checked, weekday) => {
      const hour = tz === MOSCOW ? 21 : 8;
      const { svc, swapReminder, practices } = makePlanner(false);
      await svc.planDay(
        makeUser({ notifyTimezone: tz, notifyLocalHour: hour }),
        FRIDAY_WALK,
      );
      expect(practices.getMissedPlans).toHaveBeenCalledWith(42n, checked);
      expect(swapReminder.mock.calls.map((c) => [c[1], c[3]])).toEqual([
        ['practice_missed', { weekday }],
      ]);
    },
  );

  it('missedPlanWeekday: накануне дня отправки — шаблонное «Вчера», раньше — номер дня недели', () => {
    expect(missedPlanWeekday('2026-11-07', '2026-11-08')).toBeUndefined();
    expect(missedPlanWeekday('2026-11-06', '2026-11-08')).toBe(5); // пятница
    expect(missedPlanWeekday('2026-11-03', '2026-11-05')).toBe(2); // вторник
  });
});

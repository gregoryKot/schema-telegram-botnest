// Пояса, где день плана — завтрашний (Владивосток +10, Магадан +11): обход в
// 00:00 UTC идёт у них в субботу или пятницу утром. Сводка недели ставится по
// дню плана (воскресенье), вопрос о невыполненном плане — о дне перед днём
// плана: тот к обходу ещё идёт, вопрос встаёт заранее, отметка плана его
// снимает (missed-plan.ts). Москва и западнее с вечерним часом — контроль: день
// перед днём плана к обходу кончился, как раньше. Текст плана и оценки в
// очередь не кладутся (РКН, #1135).
import {
  NotificationPlannerService,
  type PlannerUser,
} from './notification.planner.service';
import { addDaysLocal, localDateString } from './notification.time';

const VLADIVOSTOK = 'Asia/Vladivostok'; // +10
const MAGADAN = 'Asia/Magadan'; // +11
const MOSCOW = 'Europe/Moscow';
const KALININGRAD = 'Europe/Kaliningrad'; // +2
const NEW_YORK = 'America/New_York'; // −5 в ноябре
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

describe('невыполненный план: день перед днём плана', () => {
  // Пятничный обход: у Владивостока и Магадана день плана — суббота, и вопрос
  // о пятничном плане встаёт заранее, пока пятница ещё идёт.
  it.each([
    [VLADIVOSTOK, 8, '2026-11-06'],
    [MAGADAN, 8, '2026-11-06'],
  ])(
    '%s, %d:00: план за %s — день, который к обходу ещё идёт',
    async (tz, hour, day) => {
      const { svc, swapReminder, practices } = makePlanner(false);
      await svc.planDay(
        makeUser({ notifyTimezone: tz, notifyLocalHour: hour }),
        FRIDAY_WALK,
      );
      expect(localDateString(tz, FRIDAY_WALK)).toBe(day);
      expect(practices.getMissedPlans).toHaveBeenCalledWith(42n, day);
      // Без payload — «Вчера был план» (шаблон); под локом: такого ещё нет и
      // план этого дня не отмечен.
      expect(swapReminder.mock.calls.map((c) => c.slice(1))).toEqual([
        [
          'practice_missed',
          expect.any(Date),
          undefined,
          { unlessPending: true, openPlanDay: day },
        ],
      ]);
    },
  );

  // Поведение прежнее: план — за последний завершённый местный день.
  it.each([
    [MOSCOW, '2026-11-05'],
    [KALININGRAD, '2026-11-05'],
    [NEW_YORK, '2026-11-04'], // обход — 19:05 четверга, день плана — четверг
  ])(
    '%s, 21:00: план за %s — вчерашний к обходу день, как раньше',
    async (tz, day) => {
      const { svc, swapReminder, practices } = makePlanner(false);
      await svc.planDay(makeUser({ notifyTimezone: tz }), FRIDAY_WALK);
      expect(addDaysLocal(localDateString(tz, FRIDAY_WALK), -1)).toBe(day);
      expect(practices.getMissedPlans).toHaveBeenCalledWith(42n, day);
      expect(swapReminder.mock.calls.map((c) => [c[1], c[3], c[4]])).toEqual([
        [
          'practice_missed',
          undefined,
          { unlessPending: true, openPlanDay: day },
        ],
      ]);
    },
  );
});

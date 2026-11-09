// Хвост волны 3: у поясов, где день плана — завтрашний (Владивосток +10,
// Магадан +11), обход в 00:00 UTC идёт в субботу утром. Сводка недели
// собиралась без субботнего вечера и с окном «до местного сегодня», а
// «Вчера был план» в воскресном сообщении говорил о пятнице
// (notification.weekly.ts). Москва — контроль: у неё всё как раньше.
import {
  NotificationPlannerService,
  type PlannerUser,
} from './notification.planner.service';
import {
  missedPlanDay,
  refreshWeeklyOnFill,
  type WeeklyFillDeps,
} from './notification.weekly';
import { renderTemplate } from './notification.templates';

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
      expect(swapReminder.mock.calls.map((c) => c[1])).toEqual(['weekly']);
      expect(analytics.getWeeklyStats).toHaveBeenCalledWith(
        42n,
        tz,
        '2026-11-08',
      );
    },
  );
});

describe('невыполненный план: день назван своим именем', () => {
  // Пятничный обход: у Владивостока и Магадана день плана — суббота, а
  // последний завершённый местный день — четверг (позавчера для субботы).
  it.each([
    // tz, проверяемый день, как назван в сообщении
    [VLADIVOSTOK, '2026-11-05', 'на четверг'],
    [MAGADAN, '2026-11-05', 'на четверг'],
    [MOSCOW, '2026-11-05', undefined],
  ])(
    '%s: план за последний завершённый день %s → «%s»',
    async (tz, checked, day) => {
      const hour = tz === MOSCOW ? 21 : 8;
      const { svc, swapReminder, practices } = makePlanner(false);
      await svc.planDay(
        makeUser({ notifyTimezone: tz, notifyLocalHour: hour }),
        FRIDAY_WALK,
      );
      expect(practices.getMissedPlans).toHaveBeenCalledWith(42n, checked);
      expect(swapReminder.mock.calls.map((c) => [c[1], c[3]])).toEqual([
        ['practice_missed', { practiceText: 'Позвонить другу', day }],
      ]);
    },
  );

  it('шаблон: день из payload, без него — «Вчера»', () => {
    const fri = renderTemplate(
      'practice_missed',
      { practiceText: 'Позвонить другу', day: 'на пятницу' },
      'ty',
    );
    expect(fri?.text).toContain('🎯 План на пятницу:');
    const plain = renderTemplate(
      'practice_missed',
      { practiceText: 'Позвонить другу' },
      'vy',
    );
    expect(plain?.text).toContain('🎯 Вчера был план:');
  });

  it('missedPlanDay: накануне дня отправки — шаблонное «Вчера», раньше — день недели', () => {
    expect(missedPlanDay('2026-11-07', '2026-11-08')).toBeUndefined();
    expect(missedPlanDay('2026-11-06', '2026-11-08')).toBe('на пятницу');
    expect(missedPlanDay('2026-11-03', '2026-11-05')).toBe('на вторник');
  });
});

describe('refreshWeeklyOnFill: субботнее заполнение освежает сводку на воскресенье', () => {
  function deps(pending = true) {
    const d = {
      analyticsService: {
        getWeeklyStats: jest.fn().mockResolvedValue([]),
        getBestDayOfWeek: jest.fn().mockResolvedValue(null),
      },
      botService: { getNeeds: () => [] },
      notificationService: {
        hasPending: jest.fn().mockResolvedValue(pending),
        refreshPending: jest.fn().mockResolvedValue(undefined),
      },
      logger: { error: jest.fn() },
    };
    return d as typeof d & WeeklyFillDeps;
  }

  it('суббота, сводка стоит — текст пересобран с окном до воскресенья', async () => {
    const d = deps();
    await refreshWeeklyOnFill(d, 42n, VLADIVOSTOK, '2026-11-07', 'vy');
    expect(d.analyticsService.getWeeklyStats).toHaveBeenCalledWith(
      42n,
      VLADIVOSTOK,
      '2026-11-08',
    );
    expect(d.notificationService.refreshPending).toHaveBeenCalledWith(
      42n,
      'weekly',
      { text: expect.any(String) },
    );
  });

  it('сводки нет — ничего не считаем', async () => {
    const d = deps(false);
    await refreshWeeklyOnFill(d, 42n, VLADIVOSTOK, '2026-11-07', 'ty');
    expect(d.notificationService.hasPending).toHaveBeenCalledWith(
      42n,
      'weekly',
    );
    expect(d.analyticsService.getWeeklyStats.mock.calls).toEqual([]);
    expect(d.notificationService.refreshPending.mock.calls).toEqual([]);
  });

  it.each([
    ['пятница', '2026-11-06'],
    [
      'воскресенье — день плана (Москва: обход уже собрал её ночью)',
      '2026-11-08',
    ],
  ])('%s — не трогаем', async (_n, today) => {
    const d = deps();
    await refreshWeeklyOnFill(d, 42n, MOSCOW, today, 'ty');
    expect(d.notificationService.hasPending.mock.calls).toEqual([]);
    expect(d.notificationService.refreshPending.mock.calls).toEqual([]);
  });

  it('сбой базы — строка в лог, заполнение не падает', async () => {
    const d = deps();
    d.notificationService.hasPending.mockRejectedValue(new Error('db down'));
    await expect(
      refreshWeeklyOnFill(d, 42n, MAGADAN, '2026-11-07', 'ty'),
    ).resolves.toBeUndefined();
    expect(d.logger.error).toHaveBeenCalledWith(
      'refreshWeeklyOnFill failed',
      expect.objectContaining({ message: 'db down' }),
    );
  });
});

import {
  NotificationPlannerService,
  PlannerUser,
} from './notification.planner.service';

// 2026-07-02 — четверг; 2026-07-05 — воскресенье
const NOW = new Date('2026-07-02T00:05:00Z');
const SUNDAY = new Date('2026-07-05T00:05:00Z');
const FIRST_OF_MONTH = new Date('2026-08-01T00:05:00Z'); // суббота

function makeUser(overrides: Partial<PlannerUser> = {}): PlannerUser {
  return {
    id: BigInt(42),
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
    ...overrides,
  };
}

function makeDeps() {
  const notifications = {
    schedule: jest.fn().mockResolvedValue(undefined),
    cancel: jest.fn().mockResolvedValue(undefined),
    hasPending: jest.fn().mockResolvedValue(false),
  } as any;
  const cadence = {
    expirePauseIfDue: jest.fn().mockResolvedValue('none'),
    evaluate: jest.fn().mockResolvedValue({ remindToday: true }),
  } as any;
  const botService = {
    getNeeds: jest.fn().mockReturnValue([
      { id: 'attachment', emoji: '🤝', chartLabel: 'Привязанность' },
      { id: 'autonomy', emoji: '🚀', chartLabel: 'Автономия' },
    ]),
  } as any;
  const practices = {
    getMissedPlans: jest.fn().mockResolvedValue([]),
  } as any;
  const analytics = {
    getDaysSinceLastFill: jest.fn().mockResolvedValue(1),
    getWeeklyStats: jest.fn().mockResolvedValue([]),
    getBestDayOfWeek: jest.fn().mockResolvedValue(null),
    getConsecutiveDays: jest.fn().mockResolvedValue(0),
    getHistoryRatings: jest.fn().mockResolvedValue([]),
    getLowStreakNeeds: jest.fn().mockResolvedValue([]),
    getTotalDaysFilled: jest.fn().mockResolvedValue(0),
    getProfileInsight: jest.fn().mockResolvedValue(null),
  } as any;
  return { notifications, cadence, botService, practices, analytics };
}

function make(deps = makeDeps()) {
  return {
    deps,
    svc: new NotificationPlannerService(
      deps.notifications,
      deps.cadence,
      deps.botService,
      deps.analytics,
      deps.practices,
    ),
  };
}

function scheduledTypes(deps: ReturnType<typeof makeDeps>): string[] {
  return deps.notifications.schedule.mock.calls.map((c: any[]) => c[1]);
}

describe('NotificationPlannerService.planDay — дневной бюджет', () => {
  it('пауза активна → ничего не планируется', async () => {
    const { svc, deps } = make();
    deps.cadence.expirePauseIfDue.mockResolvedValue('paused');
    await svc.planDay(makeUser(), NOW);
    expect(deps.notifications.schedule).not.toHaveBeenCalled();
    expect(deps.cadence.evaluate).not.toHaveBeenCalled();
  });

  it('пауза истекла → только welcome_back', async () => {
    const { svc, deps } = make();
    deps.cadence.expirePauseIfDue.mockResolvedValue('expired');
    await svc.planDay(makeUser(), NOW);
    expect(scheduledTypes(deps)).toEqual(['welcome_back']);
    expect(deps.cadence.evaluate).not.toHaveBeenCalled();
  });

  it('обычный день напоминания → ровно один reminder', async () => {
    const { svc, deps } = make();
    await svc.planDay(makeUser(), NOW);
    expect(scheduledTypes(deps)).toEqual(['reminder']);
  });

  it('remindToday=false и нет других причин → тишина', async () => {
    const { svc, deps } = make();
    deps.cadence.evaluate.mockResolvedValue({ remindToday: false });
    await svc.planDay(makeUser(), NOW);
    expect(deps.notifications.schedule).not.toHaveBeenCalled();
  });

  it('notifyReminderEnabled=false → reminder не планируется', async () => {
    const { svc, deps } = make();
    await svc.planDay(makeUser({ notifyReminderEnabled: false }), NOW);
    expect(scheduledTypes(deps)).not.toContain('reminder');
  });

  it('движок оценивается каждую ночь даже когда день занят lapsing-сообщением', async () => {
    const { svc, deps } = make();
    deps.analytics.getDaysSinceLastFill.mockResolvedValue(3);
    await svc.planDay(makeUser(), NOW);
    expect(deps.cadence.evaluate).toHaveBeenCalled();
  });

  describe('перерывы', () => {
    it.each([
      [3, 'lapsing_3'],
      [7, 'dormant_7'],
      [30, 'reengagement_30'],
      [75, 'nudge'], // 30 + 45
      [120, 'nudge'], // 30 + 90
    ])('день %i → %s (и отмена reminder)', async (days, type) => {
      const { svc, deps } = make();
      deps.analytics.getDaysSinceLastFill.mockResolvedValue(days);
      await svc.planDay(makeUser(), NOW);
      expect(scheduledTypes(deps)).toEqual([type]);
      expect(deps.notifications.cancel).toHaveBeenCalledWith(
        BigInt(42),
        'reminder',
      );
    });

    it('день 2 больше НЕ триггерит ничего (lapsing_2 удалён) — идёт обычный reminder', async () => {
      const { svc, deps } = make();
      deps.analytics.getDaysSinceLastFill.mockResolvedValue(2);
      await svc.planDay(makeUser(), NOW);
      expect(scheduledTypes(deps)).toEqual(['reminder']);
    });

    it('lapsing_3 подавляется при уровне ≥2 — перерыв ожидаем', async () => {
      const { svc, deps } = make();
      deps.analytics.getDaysSinceLastFill.mockResolvedValue(3);
      deps.cadence.evaluate.mockResolvedValue({ remindToday: false });
      await svc.planDay(makeUser({ notifyAdaptiveLevel: 2 }), NOW);
      expect(deps.notifications.schedule).not.toHaveBeenCalled();
    });

    it('dormant_7 подавляется при уровне ≥2, но reengagement_30 — нет', async () => {
      const { svc, deps } = make();
      deps.analytics.getDaysSinceLastFill.mockResolvedValue(7);
      deps.cadence.evaluate.mockResolvedValue({ remindToday: false });
      await svc.planDay(makeUser({ notifyFrequency: 3 }), NOW);
      expect(deps.notifications.schedule).not.toHaveBeenCalled();

      deps.analytics.getDaysSinceLastFill.mockResolvedValue(30);
      await svc.planDay(makeUser({ notifyFrequency: 3 }), NOW);
      expect(scheduledTypes(deps)).toEqual(['reengagement_30']);
    });

    it('не дублирует lapsing при уже стоящем pending', async () => {
      const { svc, deps } = make();
      deps.analytics.getDaysSinceLastFill.mockResolvedValue(3);
      deps.notifications.hasPending.mockResolvedValue(true);
      await svc.planDay(makeUser(), NOW);
      expect(deps.notifications.schedule).not.toHaveBeenCalled();
    });
  });

  describe('weekly / donate', () => {
    it('воскресенье + активен → weekly вместо reminder', async () => {
      const { svc, deps } = make();
      deps.analytics.getWeeklyStats.mockResolvedValue([
        { needId: 'attachment', avg: 6, trend: '→' },
      ]);
      await svc.planDay(makeUser(), SUNDAY);
      expect(scheduledTypes(deps)).toEqual(['weekly']);
      expect(deps.notifications.cancel).toHaveBeenCalledWith(
        BigInt(42),
        'reminder',
      );
    });

    it('воскресенье + спит ≥7 дней → weekly не шлём', async () => {
      const { svc, deps } = make();
      deps.analytics.getDaysSinceLastFill.mockResolvedValue(10);
      deps.cadence.evaluate.mockResolvedValue({ remindToday: false });
      await svc.planDay(makeUser(), SUNDAY);
      expect(scheduledTypes(deps)).not.toContain('weekly');
    });

    it('1-е число + активен → donate_reminder (один в день)', async () => {
      const { svc, deps } = make();
      deps.cadence.evaluate.mockResolvedValue({ remindToday: false });
      await svc.planDay(makeUser(), FIRST_OF_MONTH);
      expect(scheduledTypes(deps)).toEqual(['donate_reminder']);
    });
  });

  describe('дни без напоминания', () => {
    it('вчерашний невыполненный план → practice_missed', async () => {
      const { svc, deps } = make();
      deps.cadence.evaluate.mockResolvedValue({ remindToday: false });
      deps.practices.getMissedPlans.mockResolvedValue([
        { practiceText: 'Позвонить другу' },
      ]);
      await svc.planDay(makeUser(), NOW);
      expect(scheduledTypes(deps)).toEqual(['practice_missed']);
    });

    it('низкая потребность 10 дней → low_streak_insight с booking', async () => {
      const { svc, deps } = make();
      deps.cadence.evaluate.mockResolvedValue({ remindToday: false });
      deps.analytics.getLowStreakNeeds.mockResolvedValue(['attachment']);
      await svc.planDay(makeUser(), NOW);
      expect(scheduledTypes(deps)).toEqual(['low_streak_insight']);
      const payload = deps.notifications.schedule.mock.calls[0][3];
      expect(payload.showBooking).toBe(true);
    });

    it('в день напоминания practice_missed уступает reminder (бюджет)', async () => {
      const { svc, deps } = make();
      deps.practices.getMissedPlans.mockResolvedValue([
        { practiceText: 'Позвонить другу' },
      ]);
      await svc.planDay(makeUser(), NOW);
      expect(scheduledTypes(deps)).toEqual(['reminder']);
    });
  });

  describe('value_recap (день 14)', () => {
    it('день 14 + есть портрет → value_recap с данными', async () => {
      const { svc, deps } = make();
      deps.cadence.evaluate.mockResolvedValue({ remindToday: false });
      deps.analytics.getDaysSinceLastFill.mockResolvedValue(14);
      deps.analytics.getProfileInsight.mockResolvedValue({
        totalDays: 20,
        strongest: 'attachment',
        strongestAvg: 7.2,
        weakest: 'autonomy',
        weakestAvg: 4.1,
      });
      await svc.planDay(makeUser(), NOW);
      expect(scheduledTypes(deps)).toEqual(['value_recap']);
      const payload = deps.notifications.schedule.mock.calls[0][3];
      expect(payload).toMatchObject({
        totalDays: 20,
        strongest: 'Привязанность',
        weakest: 'Автономия',
      });
    });

    it('день 14 без портрета → тишина (не шлём value_recap)', async () => {
      const { svc, deps } = make();
      deps.cadence.evaluate.mockResolvedValue({ remindToday: false });
      deps.analytics.getDaysSinceLastFill.mockResolvedValue(14);
      deps.analytics.getProfileInsight.mockResolvedValue(null);
      await svc.planDay(makeUser(), NOW);
      expect(deps.notifications.schedule).not.toHaveBeenCalled();
    });
  });

  describe('игровой режим', () => {
    it('gamified + серия 6 → reminder с approachingStreak=7', async () => {
      const { svc, deps } = make();
      deps.analytics.getConsecutiveDays.mockResolvedValue(6);
      await svc.planDay(makeUser({ notifyGamified: true }), NOW);
      const payload = deps.notifications.schedule.mock.calls[0][3];
      expect(payload.gamified).toBe(true);
      expect(payload.approachingStreak).toBe(7);
    });

    it('не gamified → approachingStreak undefined', async () => {
      const { svc, deps } = make();
      deps.analytics.getConsecutiveDays.mockResolvedValue(6);
      await svc.planDay(makeUser(), NOW);
      const payload = deps.notifications.schedule.mock.calls[0][3];
      expect(payload.gamified).toBe(false);
      expect(payload.approachingStreak).toBeUndefined();
    });
  });

  describe('value-anchored донат', () => {
    it('1-е число → donate_reminder с totalDays', async () => {
      const { svc, deps } = make();
      deps.cadence.evaluate.mockResolvedValue({ remindToday: false });
      deps.analytics.getTotalDaysFilled.mockResolvedValue(45);
      await svc.planDay(makeUser(), FIRST_OF_MONTH);
      expect(scheduledTypes(deps)).toEqual(['donate_reminder']);
      const payload = deps.notifications.schedule.mock.calls[0][3];
      expect(payload.totalDays).toBe(45);
    });
  });
});

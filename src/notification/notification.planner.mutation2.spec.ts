// Продолжение усиления notification.planner.service.ts против выживших
// мутантов: границы daysSince<7 (ровно 7), выбор lowNeeds10 vs lowNeeds3
// при непустых обоих, null-avg в weeklyStats, approachingStreak не близко,
// дата "вчера" для getMissedPlans (UnaryOperator -1 → +1).
import {
  NotificationPlannerService,
  PlannerUser,
} from './notification.planner.service';
import { addDaysLocal, localDateString } from './notification.time';

const NOW = new Date('2026-07-02T00:05:00Z');
const SUNDAY = new Date('2026-07-05T00:05:00Z');
const FIRST_OF_MONTH = new Date('2026-08-01T00:05:00Z');

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
    nextReminderSeq: jest.fn().mockResolvedValue(1),
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

describe('NotificationPlannerService — weekly/donate: граница daysSince<7 РОВНО на 7', () => {
  it('воскресенье + daysSince=7 (ровно граница) → weekly НЕ шлём (EqualityOperator < vs <=)', async () => {
    const { svc, deps } = make();
    deps.analytics.getDaysSinceLastFill.mockResolvedValue(7);
    deps.cadence.evaluate.mockResolvedValue({ remindToday: false });
    await svc.planDay(makeUser({ notifyFrequency: 3 }), SUNDAY);
    expect(scheduledTypes(deps)).not.toContain('weekly');
  });

  it('1-е число + daysSince=7 (ровно граница) → donate_reminder НЕ шлём', async () => {
    const { svc, deps } = make();
    deps.analytics.getDaysSinceLastFill.mockResolvedValue(7);
    deps.cadence.evaluate.mockResolvedValue({ remindToday: false });
    await svc.planDay(makeUser(), FIRST_OF_MONTH);
    expect(scheduledTypes(deps)).not.toContain('donate_reminder');
  });

  it('weekly payload — ровно {text}, лишних полей нет (ObjectLiteral)', async () => {
    const { svc, deps } = make();
    await svc.planDay(makeUser(), SUNDAY);
    const payload = deps.notifications.schedule.mock.calls[0][3];
    expect(Object.keys(payload)).toEqual(['text']);
  });
});

describe('NotificationPlannerService — getMissedPlans запрашивается за ВЧЕРА, не завтра', () => {
  it('дата, переданная в getMissedPlans, на 1 день раньше локального "сегодня" (UnaryOperator -1→+1)', async () => {
    const { svc, deps } = make();
    deps.cadence.evaluate.mockResolvedValue({ remindToday: false });
    await svc.planDay(makeUser(), NOW);
    const today = localDateString('Europe/Moscow', NOW);
    const expectedYesterday = addDaysLocal(today, -1);
    expect(deps.practices.getMissedPlans).toHaveBeenCalledWith(
      BigInt(42),
      expectedYesterday,
    );
  });
});

describe('NotificationPlannerService — lowNeeds10 предпочитается lowNeeds3, когда оба непусты', () => {
  it('10-дневная и 3-дневная серии различаются → используется именно 10-дневная (ConditionalExpression на тернарнике)', async () => {
    const { svc, deps } = make();
    deps.cadence.evaluate.mockResolvedValue({ remindToday: false });
    deps.analytics.getLowStreakNeeds.mockImplementation(
      (_uid: bigint, _n: number, days: number) =>
        Promise.resolve(days === 10 ? ['autonomy'] : ['attachment']),
    );
    await svc.planDay(makeUser(), NOW);
    const payload = deps.notifications.schedule.mock.calls[0][3];
    expect(payload.text).toContain('Автономия'); // из 10-дневного списка
    expect(payload.showBooking).toBe(true);
  });
});

describe('NotificationPlannerService — weeklyStats с null avg не считаются "самой слабой"', () => {
  it('потребность с avg=null исключается из выбора lowest (ConditionalExpression filter !==null)', async () => {
    const { svc, deps } = make();
    deps.analytics.getWeeklyStats.mockResolvedValue([
      { needId: 'attachment', avg: null, trend: '→' },
      { needId: 'autonomy', avg: 5, trend: '→' },
    ]);
    await svc.planDay(makeUser(), NOW); // daysSince=1 → reminder, не onBreak
    const payload = deps.notifications.schedule.mock.calls[0][3];
    expect(payload.lowestNeedId).toBe('autonomy');
    expect(payload.lowestNeed).toBe('Автономия');
  });
});

describe('NotificationPlannerService — approachingStreak: gamified, но серия НЕ близка к вехе', () => {
  it('gamified=true, streak=2 (2+1=3, не веха) → approachingStreak остаётся undefined', async () => {
    const { svc, deps } = make();
    deps.analytics.getConsecutiveDays.mockResolvedValue(2);
    await svc.planDay(makeUser({ notifyGamified: true }), NOW);
    const payload = deps.notifications.schedule.mock.calls[0][3];
    expect(payload.approachingStreak).toBeUndefined();
  });
});

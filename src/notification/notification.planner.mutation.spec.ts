// Точечное усиление notification.planner.service.ts против выживших
// мутантов (Stryker waveB): границы условий (daysSince>=0/<7/>30, nudge-цикл
// %45), optional-chaining на найденных потребностях, арифметика uid%3n,
// точные payload-объекты (не просто toHaveBeenCalled).
import {
  NotificationPlannerService,
  PlannerUser,
} from './notification.planner.service';

const NOW = new Date('2026-07-02T00:05:00Z'); // четверг
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

describe('NotificationPlannerService — nudge-цикл (daysSince>30 && (d-30)%45===0)', () => {
  it('день 74 (30+44, не кратно 45) — nudge НЕ шлём (EqualityOperator === vs >=)', async () => {
    const { svc, deps } = make();
    deps.analytics.getDaysSinceLastFill.mockResolvedValue(74);
    await svc.planDay(makeUser(), NOW);
    expect(scheduledTypes(deps)).not.toContain('nudge');
  });

  it('день 30 (ровно граница ">30", не ">=30") — идёт reengagement_30, а не nudge', async () => {
    const { svc, deps } = make();
    deps.analytics.getDaysSinceLastFill.mockResolvedValue(30);
    await svc.planDay(makeUser(), NOW);
    expect(scheduledTypes(deps)).toEqual(['reengagement_30']);
  });

  it('welcome_back не дублируется при уже стоящем pending (StringLiteral+ConditionalExpression на hasPending)', async () => {
    const { svc, deps } = make();
    deps.cadence.expirePauseIfDue.mockResolvedValue('expired');
    deps.notifications.hasPending.mockResolvedValue(true);
    await svc.planDay(makeUser(), NOW);
    expect(deps.notifications.hasPending).toHaveBeenCalledWith(
      BigInt(42),
      'welcome_back',
    );
    expect(deps.notifications.schedule).not.toHaveBeenCalled();
  });
});

describe('NotificationPlannerService — value_recap: optional chaining на найденных потребностях', () => {
  it('insight.strongest не совпадает ни с одной известной потребностью → strongest=undefined, не падает (ConditionalExpression на find-предикате)', async () => {
    const { svc, deps } = make();
    deps.cadence.evaluate.mockResolvedValue({ remindToday: false });
    deps.analytics.getDaysSinceLastFill.mockResolvedValue(14);
    deps.analytics.getProfileInsight.mockResolvedValue({
      totalDays: 5,
      strongest: 'unknown_need_id',
      strongestAvg: 5,
      weakest: 'autonomy',
      weakestAvg: 3,
    });
    await svc.planDay(makeUser(), NOW);
    const payload = deps.notifications.schedule.mock.calls[0][3];
    expect(payload.strongest).toBeUndefined();
    expect(payload.weakest).toBe('Автономия');
  });

  it('value_recap отменяет reminder перед планированием (StringLiteral "reminder" в cancel)', async () => {
    const { svc, deps } = make();
    deps.cadence.evaluate.mockResolvedValue({ remindToday: false });
    deps.analytics.getDaysSinceLastFill.mockResolvedValue(14);
    deps.analytics.getProfileInsight.mockResolvedValue({
      totalDays: 5,
      strongest: 'attachment',
      strongestAvg: 5,
      weakest: 'autonomy',
      weakestAvg: 3,
    });
    await svc.planDay(makeUser(), NOW);
    expect(deps.notifications.cancel).toHaveBeenCalledWith(
      BigInt(42),
      'reminder',
    );
  });
});

describe('NotificationPlannerService — weekly/donate: seed из uid%3n, а не uid*3n', () => {
  it('weekly: seed = Number(uid%3n), не uid*3n — выбирает практику по правильному индексу', async () => {
    const { svc, deps } = make();
    // avg<6 форсирует ветку buildWeeklySummaryText, которая вызывает
    // pickPractice('attachment', seed) → list[seed % 3]. uid=44n: правильный
    // seed = Number(44n%3n) = 2 → 3-я практика в списке. Мутация uid*3n дала
    // бы Number(132n)=132 → 132%3=0 → 1-я практика — тексты различимы.
    deps.analytics.getWeeklyStats.mockResolvedValue([
      { needId: 'attachment', avg: 3, trend: '→' },
    ]);
    const user = makeUser({ id: BigInt(44) });
    await svc.planDay(user, SUNDAY);
    const text = deps.notifications.schedule.mock.calls[0][3].text as string;
    expect(text).toContain('Поделиться чем-то личным в разговоре');
    expect(text).not.toContain('Написать кому-то близкому без повода');
  });

  it('donate_reminder: seed = Number(uid%3n), payload содержит корректный диапазон 0..2', async () => {
    const { svc, deps } = make();
    deps.cadence.evaluate.mockResolvedValue({ remindToday: false });
    const user = makeUser({ id: BigInt(7) }); // 7 % 3n = 1n
    await svc.planDay(user, FIRST_OF_MONTH);
    const payload = deps.notifications.schedule.mock.calls[0][3];
    expect(payload.seed).toBe(1);
  });
});

describe('NotificationPlannerService — practice_missed: точный payload и StringLiteral hasPending', () => {
  it('несколько пропущенных практик объединяются через ", " (ArrowFunction+join)', async () => {
    const { svc, deps } = make();
    deps.cadence.evaluate.mockResolvedValue({ remindToday: false });
    deps.practices.getMissedPlans.mockResolvedValue([
      { practiceText: 'Позвонить другу' },
      { practiceText: 'Прогулка' },
    ]);
    await svc.planDay(makeUser(), NOW);
    const payload = deps.notifications.schedule.mock.calls[0][3];
    expect(payload).toEqual({
      practiceText: 'Позвонить другу, Прогулка',
    });
  });

  it('practice_missed не дублируется при уже стоящем pending', async () => {
    const { svc, deps } = make();
    deps.cadence.evaluate.mockResolvedValue({ remindToday: false });
    deps.practices.getMissedPlans.mockResolvedValue([
      { practiceText: 'Позвонить другу' },
    ]);
    deps.notifications.hasPending.mockResolvedValue(true);
    await svc.planDay(makeUser(), NOW);
    expect(deps.notifications.hasPending).toHaveBeenCalledWith(
      BigInt(42),
      'practice_missed',
    );
    expect(deps.notifications.schedule).not.toHaveBeenCalled();
  });
});

describe('NotificationPlannerService — low_streak_insight: lowest без optional chaining на 3-дневном фолбэке', () => {
  it('lowNeeds10 пуст, lowNeeds3 не пуст → берём lowNeeds3 (ConditionalExpression)', async () => {
    const { svc, deps } = make();
    deps.cadence.evaluate.mockResolvedValue({ remindToday: false });
    deps.analytics.getLowStreakNeeds.mockImplementation(
      (_uid: bigint, _n: number, days: number) =>
        Promise.resolve(days === 10 ? [] : ['attachment']),
    );
    await svc.planDay(makeUser(), NOW);
    expect(scheduledTypes(deps)).toEqual(['low_streak_insight']);
  });

  it('оба списка пусты → тишина (низкая потребность не найдена)', async () => {
    const { svc, deps } = make();
    deps.cadence.evaluate.mockResolvedValue({ remindToday: false });
    deps.analytics.getLowStreakNeeds.mockResolvedValue([]);
    await svc.planDay(makeUser(), NOW);
    // Обе серии (3 и 10 дней) реально запрошены — тишина не из-за того, что
    // движок вообще не дошёл до проверки, а из-за пустого результата обеих.
    expect(deps.analytics.getLowStreakNeeds).toHaveBeenCalledWith(
      BigInt(42),
      5,
      3,
      'Europe/Moscow',
    );
    expect(deps.analytics.getLowStreakNeeds).toHaveBeenCalledWith(
      BigInt(42),
      5,
      10,
      'Europe/Moscow',
    );
    expect(deps.notifications.schedule).not.toHaveBeenCalled();
  });

  it('low_streak_insight не дублируется при уже стоящем pending (StringLiteral+ConditionalExpression)', async () => {
    const { svc, deps } = make();
    deps.cadence.evaluate.mockResolvedValue({ remindToday: false });
    deps.analytics.getLowStreakNeeds.mockResolvedValue(['attachment']);
    deps.notifications.hasPending.mockResolvedValue(true);
    await svc.planDay(makeUser(), NOW);
    expect(deps.notifications.hasPending).toHaveBeenCalledWith(
      BigInt(42),
      'low_streak_insight',
    );
    expect(deps.notifications.schedule).not.toHaveBeenCalled();
  });
});

describe('NotificationPlannerService — scheduleReminder: cancel(reminder) StringLiteral', () => {
  it('всегда отменяет прежний reminder перед планированием нового', async () => {
    const { svc, deps } = make();
    await svc.planDay(makeUser(), NOW);
    expect(deps.notifications.cancel).toHaveBeenCalledWith(
      BigInt(42),
      'reminder',
    );
  });
});

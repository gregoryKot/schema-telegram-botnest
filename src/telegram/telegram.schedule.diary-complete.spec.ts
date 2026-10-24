// Поведенческие тесты onDiaryComplete: юзер заполнил трекер за сегодня →
// отмена reminder/pre_reminder/low_streak_insight, регистрация cadence,
// планирование summary, парный триггер (не роняет метод при падении), и
// ветка «comeback vs вехи» (streak/onboarding/anniversary) — единственное
// проактивное сообщение в день (аудит 2026-07, план NotificationPlannerService).
// До этого теста метод был непокрыт (см. отчёт покрытия src/telegram, аудит
// 2026-08) — самый крупный незакрытый кусок telegram.schedule.service.ts.
import { TelegramScheduleService } from './telegram.schedule.service';
import type { Need } from '../bot/bot.service';

const NEEDS: Need[] = [
  {
    id: 'attachment',
    emoji: '🤝',
    title: 'Привязанность',
    fullTitle: 'Привязанность',
    chartLabel: 'Привязанность',
  },
  {
    id: 'autonomy',
    emoji: '🧭',
    title: 'Автономия',
    fullTitle: 'Автономия',
    chartLabel: 'Автономия',
  },
];

function makeService(opts: {
  gap?: number | null;
  totalDays?: number;
  streak?: number;
  hasEver?: boolean;
  hasPending?: boolean;
  lastComebackSentAt?: Date | null;
  profileInsight?: { strongest: string; strongestAvg: number } | null;
}) {
  const scheduled: Array<{ userId: bigint; type: string; extra?: unknown }> =
    [];
  const botService: any = {
    getUserSettings: jest.fn().mockResolvedValue({
      notifyTimezone: 'Europe/Moscow',
      notifyLocalHour: 21,
      addressForm: 'ty',
    }),
    getNeeds: jest.fn(() => NEEDS),
    getRatings: jest.fn().mockResolvedValue({ attachment: 5 }),
  };
  const analyticsService: any = {
    getTotalDaysFilled: jest.fn().mockResolvedValue(opts.totalDays ?? 0),
    getGapBeforeLatestFill: jest.fn().mockResolvedValue(opts.gap ?? null),
    getConsecutiveDays: jest.fn().mockResolvedValue(opts.streak ?? 0),
    getProfileInsight: jest.fn().mockResolvedValue(opts.profileInsight ?? null),
  };
  const pairsService: any = { getUserPairs: jest.fn().mockResolvedValue([]) };
  const notificationService: any = {
    cancel: jest.fn().mockResolvedValue(undefined),
    schedule: jest.fn(
      (userId: bigint, type: string, _at: Date, extra?: unknown) => {
        scheduled.push({ userId, type, extra });
        return Promise.resolve();
      },
    ),
    lastSentAt: jest.fn().mockResolvedValue(opts.lastComebackSentAt ?? null),
    hasPending: jest.fn().mockResolvedValue(opts.hasPending ?? false),
    hasEver: jest.fn().mockResolvedValue(opts.hasEver ?? false),
  };
  const cadenceService: any = {
    registerFill: jest.fn().mockResolvedValue(undefined),
  };
  const plannerService: any = {};
  const cronLeader: any = { claimRun: jest.fn().mockResolvedValue(true) };
  const service = new TelegramScheduleService(
    null,
    botService,
    analyticsService,
    accountServiceStub(),
    pairsService,
    notificationService,
    cadenceService,
    plannerService,
    cronLeader,
  );
  return {
    service,
    scheduled,
    notificationService,
    cadenceService,
    analyticsService,
  };
}

function accountServiceStub(): any {
  return { getAllUsersWithSettings: jest.fn() };
}

// Момент фиксирован днём по МСК — иначе utcInstantForLocalHour(21ч) может
// оказаться то в будущем, то в прошлом относительно «сейчас» на границе суток,
// и тест на «summary после текущего часа» станет флаки.
const FIXED_NOW = new Date('2026-07-16T10:00:00+03:00');

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(FIXED_NOW);
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('onDiaryComplete — базовые побочные эффекты', () => {
  it('отменяет reminder/pre_reminder/low_streak_insight и регистрирует cadence-заполнение', async () => {
    const { service, notificationService, cadenceService } = makeService({});
    await service.onDiaryComplete(1n);
    expect(notificationService.cancel).toHaveBeenCalledWith(1n, 'reminder');
    expect(notificationService.cancel).toHaveBeenCalledWith(1n, 'pre_reminder');
    expect(notificationService.cancel).toHaveBeenCalledWith(
      1n,
      'low_streak_insight',
    );
    expect(cadenceService.registerFill).toHaveBeenCalledWith(1n);
  });

  it('планирует summary с реальным текстом сводки (не заглушкой) на сегодняшний notifyLocalHour', async () => {
    const { service, scheduled } = makeService({});
    await service.onDiaryComplete(1n);
    const summary = scheduled.find((s) => s.type === 'summary');
    expect(summary).toBeDefined();
    expect((summary!.extra as any).text).toContain('Привязанность');
  });

  it('парный триггер падает — не роняет onDiaryComplete целиком (изоляция ошибок)', async () => {
    const { service, notificationService } = makeService({});
    const pairsError = new Error('pair lookup down');
    (service as any).pairsService.getUserPairs = jest
      .fn()
      .mockRejectedValue(pairsError);
    await expect(service.onDiaryComplete(1n)).resolves.toBeUndefined();
    // Несмотря на упавший парный триггер, summary всё равно запланирован —
    // изоляция ошибок работает, а не «одна ошибка гасит весь метод».
    expect(
      notificationService.schedule.mock.calls.some(
        (c: unknown[]) => c[1] === 'summary',
      ),
    ).toBe(true);
  });
});

describe('onDiaryComplete — comeback после перерыва ≥3 дней', () => {
  it('gap>=3, ещё не отправляли сегодня — планирует comeback с сильнейшей потребностью из insight', async () => {
    const { service, scheduled } = makeService({
      gap: 5,
      totalDays: 10,
      profileInsight: { strongest: 'attachment', strongestAvg: 8.5 },
    });
    await service.onDiaryComplete(1n);
    const comeback = scheduled.find((s) => s.type === 'comeback');
    expect(comeback).toBeDefined();
    expect(comeback!.extra).toEqual(
      expect.objectContaining({
        totalDays: 10,
        strongestNeed: 'Привязанность',
        strongestAvg: 8.5,
      }),
    );
  });

  it('gap>=3, но уже отправляли comeback сегодня — не дублирует', async () => {
    const { service, scheduled } = makeService({
      gap: 5,
      lastComebackSentAt: FIXED_NOW,
    });
    await service.onDiaryComplete(1n);
    expect(scheduled.some((s) => s.type === 'comeback')).toBe(false);
  });

  it('gap>=3, но comeback уже висит в очереди — не дублирует', async () => {
    const { service, scheduled } = makeService({ gap: 3, hasPending: true });
    await service.onDiaryComplete(1n);
    expect(scheduled.some((s) => s.type === 'comeback')).toBe(false);
  });

  it('comeback-ветка — ранний return: streak/onboarding/anniversary не проверяются вовсе', async () => {
    const { service, scheduled, analyticsService } = makeService({
      gap: 4,
      totalDays: 7, // совпало бы с onboarding_7, если бы дошло до той ветки
      streak: 7, // совпало бы со streak_7
    });
    await service.onDiaryComplete(1n);
    expect(scheduled.some((s) => s.type === 'streak_7')).toBe(false);
    expect(scheduled.some((s) => s.type === 'onboarding_7')).toBe(false);
    expect(analyticsService.getConsecutiveDays).not.toHaveBeenCalled();
  });

  it('gap < 3 не считается перерывом — идёт обычная ветка вех, comeback не планируется', async () => {
    const { service, scheduled } = makeService({ gap: 2 });
    await service.onDiaryComplete(1n);
    expect(scheduled.some((s) => s.type === 'comeback')).toBe(false);
  });

  it('gap === null (первое заполнение) — тоже обычная ветка, без comeback', async () => {
    const { service, scheduled } = makeService({ gap: null });
    await service.onDiaryComplete(1n);
    expect(scheduled.some((s) => s.type === 'comeback')).toBe(false);
  });
});

describe('onDiaryComplete — вехи streak/onboarding/anniversary', () => {
  it('streak === 7 и ещё не было такого уведомления — планирует streak_7', async () => {
    const { service, scheduled } = makeService({ streak: 7, hasEver: false });
    await service.onDiaryComplete(1n);
    expect(scheduled.some((s) => s.type === 'streak_7')).toBe(true);
    // Остальные streak-планки (14/30) не совпали по значению — не планируются.
    expect(scheduled.some((s) => s.type === 'streak_14')).toBe(false);
  });

  it('streak === 7, но уведомление уже было (hasEver=true) — не дублирует', async () => {
    const { service, scheduled } = makeService({ streak: 7, hasEver: true });
    await service.onDiaryComplete(1n);
    expect(scheduled.some((s) => s.type === 'streak_7')).toBe(false);
  });

  it('totalDays === 3 и ещё не было — планирует onboarding_3', async () => {
    const { service, scheduled } = makeService({ totalDays: 3 });
    await service.onDiaryComplete(1n);
    expect(scheduled.some((s) => s.type === 'onboarding_3')).toBe(true);
  });

  it('totalDays === 60 и ещё не было — планирует anniversary_60', async () => {
    const { service, scheduled } = makeService({ totalDays: 60 });
    await service.onDiaryComplete(1n);
    expect(scheduled.some((s) => s.type === 'anniversary_60')).toBe(true);
  });

  it('totalDays не совпадает ни с одной планкой — ничего из вех не планируется', async () => {
    const { service, scheduled } = makeService({ totalDays: 2, streak: 2 });
    await service.onDiaryComplete(1n);
    const milestoneTypes = scheduled
      .map((s) => s.type)
      .filter((t) => t !== 'summary');
    expect(milestoneTypes).toEqual([]);
  });
});

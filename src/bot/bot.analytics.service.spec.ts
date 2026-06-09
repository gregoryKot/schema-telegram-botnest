import { BotAnalyticsService } from './bot.analytics.service';

// Fixed "today" = 2025-06-11 (Wednesday), UTC noon
const FIXED_DATE = new Date('2025-06-11T12:00:00Z');

function d(daysAgo: number): string {
  const ms = FIXED_DATE.getTime() - daysAgo * 86_400_000;
  const dt = new Date(ms);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function makePrisma(overrides: Record<string, jest.Mock> = {}) {
  return {
    user: { findUnique: jest.fn().mockResolvedValue({ notifyTimezone: 'UTC' }), ...overrides.user },
    rating: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      ...overrides.rating,
    },
  } as any;
}

describe('BotAnalyticsService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(FIXED_DATE);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('getConsecutiveDays', () => {
    it('returns 0 when no ratings', async () => {
      const svc = new BotAnalyticsService(makePrisma());
      expect(await svc.getConsecutiveDays(1)).toBe(0);
    });

    it('returns 1 when only today has a rating', async () => {
      const prisma = makePrisma();
      prisma.rating.findMany.mockResolvedValue([{ date: d(0) }]);
      const svc = new BotAnalyticsService(prisma);
      expect(await svc.getConsecutiveDays(1)).toBe(1);
    });

    it('counts consecutive days ending today', async () => {
      const prisma = makePrisma();
      prisma.rating.findMany.mockResolvedValue([
        { date: d(0) }, { date: d(1) }, { date: d(2) },
      ]);
      const svc = new BotAnalyticsService(prisma);
      expect(await svc.getConsecutiveDays(1)).toBe(3);
    });

    it('stops at a gap', async () => {
      const prisma = makePrisma();
      // today + 2 days ago, but not yesterday
      prisma.rating.findMany.mockResolvedValue([{ date: d(0) }, { date: d(2) }]);
      const svc = new BotAnalyticsService(prisma);
      expect(await svc.getConsecutiveDays(1)).toBe(1);
    });

    it('returns 0 when only old entries exist', async () => {
      const prisma = makePrisma();
      prisma.rating.findMany.mockResolvedValue([{ date: d(5) }, { date: d(6) }]);
      const svc = new BotAnalyticsService(prisma);
      expect(await svc.getConsecutiveDays(1)).toBe(0);
    });
  });

  describe('getDaysSinceLastFill', () => {
    it('returns -1 when no ratings', async () => {
      const svc = new BotAnalyticsService(makePrisma());
      expect(await svc.getDaysSinceLastFill(1)).toBe(-1);
    });

    it('returns 0 when last fill is today', async () => {
      const prisma = makePrisma();
      prisma.rating.findFirst.mockResolvedValue({ date: d(0) });
      const svc = new BotAnalyticsService(prisma);
      expect(await svc.getDaysSinceLastFill(1)).toBe(0);
    });

    it('returns correct count for past fill', async () => {
      const prisma = makePrisma();
      prisma.rating.findFirst.mockResolvedValue({ date: d(3) });
      const svc = new BotAnalyticsService(prisma);
      expect(await svc.getDaysSinceLastFill(1)).toBe(3);
    });
  });

  describe('getWeeklyStats', () => {
    it('returns null avg for needs with no data', async () => {
      const svc = new BotAnalyticsService(makePrisma());
      const stats = await svc.getWeeklyStats(1);
      expect(stats.every((s) => s.avg === null)).toBe(true);
    });

    it('calculates correct average for current week', async () => {
      const prisma = makePrisma();
      prisma.rating.findMany.mockResolvedValue([
        { needId: 'attachment', date: d(0), value: 8 },
        { needId: 'attachment', date: d(1), value: 6 },
      ]);
      const svc = new BotAnalyticsService(prisma);
      const stats = await svc.getWeeklyStats(1);
      const att = stats.find((s) => s.needId === 'attachment')!;
      expect(att.avg).toBeCloseTo(7);
    });

    it('marks trend ↑ when current significantly higher than prev', async () => {
      const prisma = makePrisma();
      prisma.rating.findMany.mockResolvedValue([
        { needId: 'attachment', date: d(0), value: 9 },   // current week
        { needId: 'attachment', date: d(8), value: 4 },   // prev week
      ]);
      const svc = new BotAnalyticsService(prisma);
      const stats = await svc.getWeeklyStats(1);
      expect(stats.find((s) => s.needId === 'attachment')!.trend).toBe('↑');
    });

    it('marks trend ↓ when current significantly lower', async () => {
      const prisma = makePrisma();
      prisma.rating.findMany.mockResolvedValue([
        { needId: 'attachment', date: d(0), value: 3 },
        { needId: 'attachment', date: d(8), value: 8 },
      ]);
      const svc = new BotAnalyticsService(prisma);
      const stats = await svc.getWeeklyStats(1);
      expect(stats.find((s) => s.needId === 'attachment')!.trend).toBe('↓');
    });

    it('marks trend → when change is within ±0.5', async () => {
      const prisma = makePrisma();
      prisma.rating.findMany.mockResolvedValue([
        { needId: 'attachment', date: d(0), value: 5 },
        { needId: 'attachment', date: d(8), value: 5 },
      ]);
      const svc = new BotAnalyticsService(prisma);
      const stats = await svc.getWeeklyStats(1);
      expect(stats.find((s) => s.needId === 'attachment')!.trend).toBe('→');
    });
  });

  describe('getBestDayOfWeek', () => {
    it('returns null when no data', async () => {
      const svc = new BotAnalyticsService(makePrisma());
      expect(await svc.getBestDayOfWeek(1)).toBeNull();
    });

    it('returns null when fewer than 3 distinct weekdays have data', async () => {
      const prisma = makePrisma();
      // только 2 разных дня недели — гард sumByDow.size < 3 не даёт делать вывод
      prisma.rating.findMany.mockResolvedValue([
        { date: d(0), value: 9 },
        { date: d(1), value: 3 },
      ]);
      const svc = new BotAnalyticsService(prisma);
      expect(await svc.getBestDayOfWeek(1)).toBeNull();
    });

    it('returns day name of highest-average weekday (≥3 weekdays)', async () => {
      const prisma = makePrisma();
      // d(0)=среда(2025-06-11), d(1)=вторник, d(2)=понедельник
      prisma.rating.findMany.mockResolvedValue([
        { date: d(0), value: 8 },
        { date: d(0), value: 9 }, // среда: сумма по дате 17, avg по дню недели 17
        { date: d(1), value: 3 }, // вторник: avg 3
        { date: d(2), value: 2 }, // понедельник: avg 2
      ]);
      const svc = new BotAnalyticsService(prisma);
      expect(await svc.getBestDayOfWeek(1)).toBe('среда');
    });
  });

  // Полный prisma-мок для методов, читающих несколько источников активности.
  function makeFullPrisma(overrides: Record<string, any> = {}) {
    const empty = { findMany: jest.fn().mockResolvedValue([]) };
    return {
      user: { findUnique: jest.fn().mockResolvedValue({ notifyTimezone: 'UTC' }) },
      rating: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null) },
      appActivity: { findMany: jest.fn().mockResolvedValue([]), upsert: jest.fn().mockResolvedValue({}) },
      schemaDiaryEntry: { ...empty },
      modeDiaryEntry: { ...empty },
      gratitudeDiaryEntry: { ...empty },
      ...overrides,
    } as any;
  }

  describe('getTotalDaysFilled', () => {
    it('считает уникальные дни', async () => {
      const prisma = makeFullPrisma();
      prisma.rating.findMany.mockResolvedValue([{ date: d(0) }, { date: d(1) }]);
      expect(await new BotAnalyticsService(prisma).getTotalDaysFilled(1)).toBe(2);
    });
  });

  describe('getHistoryRatings', () => {
    it('группирует оценки по датам, отдаёт только дни с данными', async () => {
      const prisma = makeFullPrisma();
      prisma.rating.findMany.mockResolvedValue([
        { date: d(0), needId: 'attachment', value: 5 },
        { date: d(0), needId: 'play', value: 7 },
      ]);
      const hist = await new BotAnalyticsService(prisma).getHistoryRatings(1, 3);
      expect(hist).toEqual([{ date: d(0), ratings: { attachment: 5, play: 7 } }]);
    });
  });

  describe('getLowStreakNeeds', () => {
    it('возвращает потребности с данными за все дни и значениями ниже порога', async () => {
      const prisma = makeFullPrisma();
      prisma.rating.findMany.mockResolvedValue([
        { needId: 'attachment', date: d(0), value: 2 },
        { needId: 'attachment', date: d(1), value: 3 }, // оба < 4, покрыты 2 дня = days
        { needId: 'play', date: d(0), value: 5 },        // только 1 день и ≥4 → не low
      ]);
      expect(await new BotAnalyticsService(prisma).getLowStreakNeeds(1, 4, 2)).toEqual(['attachment']);
    });
  });

  describe('getStreakData', () => {
    it('сегодня заполнено: currentStreak считает подряд дни от сегодня', async () => {
      const prisma = makeFullPrisma();
      prisma.rating.findMany.mockResolvedValue([{ date: d(0) }, { date: d(1) }, { date: d(2) }]);
      const s = await new BotAnalyticsService(prisma).getStreakData(1);
      expect(s.currentStreak).toBe(3);
      expect(s.totalDays).toBe(3);
      expect(s.todayDone).toBe(true);
      expect(s.longestStreak).toBe(3);
    });

    it('сегодня не заполнено: стрик считается со вчера, todayDone=false', async () => {
      const prisma = makeFullPrisma();
      prisma.rating.findMany.mockResolvedValue([{ date: d(1) }, { date: d(2) }]);
      const s = await new BotAnalyticsService(prisma).getStreakData(1);
      expect(s.currentStreak).toBe(2);
      expect(s.todayDone).toBe(false);
    });

    it('объединяет источники активности (дневники, app activity)', async () => {
      const prisma = makeFullPrisma();
      prisma.gratitudeDiaryEntry.findMany.mockResolvedValue([{ date: d(0) }]);
      prisma.appActivity.findMany.mockResolvedValue([{ date: d(1) }]);
      const s = await new BotAnalyticsService(prisma).getStreakData(1);
      expect(s.totalDays).toBe(2);
      expect(s.currentStreak).toBe(2);
    });
  });

  describe('getAchievements', () => {
    it('первый день засчитан, длинные стрики — нет', async () => {
      const prisma = makeFullPrisma();
      prisma.rating.findMany.mockResolvedValue([{ date: d(0), needId: 'attachment', value: 5 }]);
      const a = await new BotAnalyticsService(prisma).getAchievements(1);
      expect(a.find((x) => x.id === 'first_day')!.earned).toBe(true);
      expect(a.find((x) => x.id === 'streak_3')!.earned).toBe(false);
    });

    it('high_day и all_above7 при дне со всеми 5 потребностями ≥8/≥7', async () => {
      const prisma = makeFullPrisma();
      prisma.rating.findMany.mockResolvedValue(
        (['attachment', 'autonomy', 'expression', 'play', 'limits'] as const).map((needId) => ({ date: d(0), needId, value: 8 })),
      );
      const a = await new BotAnalyticsService(prisma).getAchievements(1);
      expect(a.find((x) => x.id === 'high_day')!.earned).toBe(true);
      expect(a.find((x) => x.id === 'all_above7')!.earned).toBe(true);
    });

    it('comeback при возвращении после перерыва ≥3 дней', async () => {
      const prisma = makeFullPrisma();
      prisma.rating.findMany.mockResolvedValue([
        { date: d(10), needId: 'attachment', value: 5 },
        { date: d(0), needId: 'attachment', value: 5 }, // разрыв 10 дней
      ]);
      const a = await new BotAnalyticsService(prisma).getAchievements(1);
      expect(a.find((x) => x.id === 'comeback')!.earned).toBe(true);
    });

    it('growth при росте средней потребности на ≥3 за неделю', async () => {
      const prisma = makeFullPrisma();
      prisma.rating.findMany.mockResolvedValue([
        { date: d(0), needId: 'attachment', value: 8 }, // последние 7 дней — высоко
        { date: d(8), needId: 'attachment', value: 2 }, // предыдущие 7 — низко
      ]);
      const a = await new BotAnalyticsService(prisma).getAchievements(1);
      expect(a.find((x) => x.id === 'growth')!.earned).toBe(true);
    });
  });

  describe('recordActivity', () => {
    it('апсёртит запись активности на сегодня', async () => {
      const prisma = makeFullPrisma();
      const res = await new BotAnalyticsService(prisma).recordActivity(1);
      expect(res).toEqual({ ok: true });
      expect(prisma.appActivity.upsert).toHaveBeenCalled();
    });
  });

  describe('getWorstDayOfWeek', () => {
    it('null при данных менее чем по 3 дням недели', async () => {
      const prisma = makePrisma();
      prisma.rating.findMany.mockResolvedValue([{ date: d(0), value: 5 }, { date: d(1), value: 5 }]);
      expect(await new BotAnalyticsService(prisma).getWorstDayOfWeek(1)).toBeNull();
    });

    it('возвращает день недели с наименьшей средней (≥3 дней)', async () => {
      const prisma = makePrisma();
      // d(0)=ср=9, d(1)=вт=3, d(2)=пн=2 → худший понедельник
      prisma.rating.findMany.mockResolvedValue([
        { date: d(0), value: 9 }, { date: d(1), value: 3 }, { date: d(2), value: 2 },
      ]);
      expect(await new BotAnalyticsService(prisma).getWorstDayOfWeek(1)).toBe('понедельник');
    });
  });
});

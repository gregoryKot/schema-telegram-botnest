import { BotAnalyticsService } from './bot.analytics.service';
import { NEED_IDS as NEED_ID_LIST } from './bot.service';

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

function makePrisma(overrides: Record<string, any> = {}) {
  return {
    user: {
      findUnique: jest.fn().mockResolvedValue({ notifyTimezone: 'UTC' }),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      ...overrides.user,
    },
    rating: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      groupBy: jest.fn().mockResolvedValue([]),
      ...overrides.rating,
    },
    appActivity: {
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest.fn().mockResolvedValue({}),
      ...overrides.appActivity,
    },
    schemaDiaryEntry: {
      findMany: jest.fn().mockResolvedValue([]),
      ...overrides.schemaDiaryEntry,
    },
    modeDiaryEntry: {
      findMany: jest.fn().mockResolvedValue([]),
      ...overrides.modeDiaryEntry,
    },
    gratitudeDiaryEntry: {
      findMany: jest.fn().mockResolvedValue([]),
      ...overrides.gratitudeDiaryEntry,
    },
    pair: {
      count: jest.fn().mockResolvedValue(0),
      ...overrides.pair,
    },
    $queryRaw: overrides.$queryRaw ?? makeQueryRawMock(),
  } as any;
}

// $queryRaw в BotAnalyticsService используется несколькими разными сырыми
// запросами (getAdminStats/getRetentionStats) — тег-функция разбирает
// шаблон-стрингу и по узнаваемому фрагменту SQL решает, что вернуть, вместо
// хрупкой привязки к порядку вызовов Promise.all.
function makeQueryRawMock(
  cfg: {
    cohortPoint?: (n: number) => { cohort: number; retained: number };
    filledOnce30?: number;
    todayCount?: number;
    month30Count?: number;
    ret1?: number;
    ret3?: number;
    ret7?: number;
    ret30?: number;
  } = {},
) {
  return jest.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join('|');
    if (text.includes('AS cohort')) {
      const n = values[0] as number;
      const r = cfg.cohortPoint?.(n) ?? { cohort: 0, retained: 0 };
      return Promise.resolve([
        { cohort: BigInt(r.cohort), retained: BigInt(r.retained) },
      ]);
    }
    if (text.includes('EXISTS (SELECT 1 FROM "Rating" r')) {
      return Promise.resolve([{ c: BigInt(cfg.filledOnce30 ?? 0) }]);
    }
    if (text.includes('WHERE date = ')) {
      return Promise.resolve([{ c: BigInt(cfg.todayCount ?? 0) }]);
    }
    if (text.includes('WHERE date >= ')) {
      return Promise.resolve([{ c: BigInt(cfg.month30Count ?? 0) }]);
    }
    if (text.includes('>= 1)'))
      return Promise.resolve([{ cnt: BigInt(cfg.ret1 ?? 0) }]);
    if (text.includes('>= 3)'))
      return Promise.resolve([{ cnt: BigInt(cfg.ret3 ?? 0) }]);
    if (text.includes('>= 7)'))
      return Promise.resolve([{ cnt: BigInt(cfg.ret7 ?? 0) }]);
    if (text.includes('>= 30)'))
      return Promise.resolve([{ cnt: BigInt(cfg.ret30 ?? 0) }]);
    return Promise.resolve([]);
  });
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
        { date: d(0) },
        { date: d(1) },
        { date: d(2) },
      ]);
      const svc = new BotAnalyticsService(prisma);
      expect(await svc.getConsecutiveDays(1)).toBe(3);
    });

    it('stops at a gap', async () => {
      const prisma = makePrisma();
      // today + 2 days ago, but not yesterday
      prisma.rating.findMany.mockResolvedValue([
        { date: d(0) },
        { date: d(2) },
      ]);
      const svc = new BotAnalyticsService(prisma);
      expect(await svc.getConsecutiveDays(1)).toBe(1);
    });

    it('returns 0 when only old entries exist', async () => {
      const prisma = makePrisma();
      prisma.rating.findMany.mockResolvedValue([
        { date: d(5) },
        { date: d(6) },
      ]);
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
        { needId: 'attachment', date: d(0), value: 9 }, // current week
        { needId: 'attachment', date: d(8), value: 4 }, // prev week
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

    it('returns day name of highest-sum day (needs 3 distinct days of week)', async () => {
      const prisma = makePrisma();
      // d(0) = 2025-06-11 = Wednesday (среда); d(1) = вторник; d(2) = понедельник
      prisma.rating.findMany.mockResolvedValue([
        { date: d(0), value: 8 },
        { date: d(0), value: 9 },
        { date: d(1), value: 3 },
        { date: d(2), value: 5 },
      ]);
      const svc = new BotAnalyticsService(prisma);
      expect(await svc.getBestDayOfWeek(1)).toBe('среда');
    });
  });

  describe('getFillDaysInLast', () => {
    it('counts distinct fill days within the window', async () => {
      const prisma = makePrisma();
      prisma.rating.findMany.mockResolvedValue([
        { date: d(0) },
        { date: d(2) },
      ]);
      const svc = new BotAnalyticsService(prisma);
      expect(await svc.getFillDaysInLast(1, 7)).toBe(2);
    });

    it('returns 0 with no ratings', async () => {
      const svc = new BotAnalyticsService(makePrisma());
      expect(await svc.getFillDaysInLast(1, 7)).toBe(0);
    });
  });

  describe('getGapBeforeLatestFill', () => {
    it('returns null with fewer than two fill days', async () => {
      const prisma = makePrisma();
      prisma.rating.findMany.mockResolvedValue([{ date: d(0) }]);
      const svc = new BotAnalyticsService(prisma);
      expect(await svc.getGapBeforeLatestFill(1)).toBeNull();
    });

    it('returns gap between two latest distinct dates', async () => {
      const prisma = makePrisma();
      prisma.rating.findMany.mockResolvedValue([
        { date: d(0) },
        { date: d(5) },
      ]);
      const svc = new BotAnalyticsService(prisma);
      expect(await svc.getGapBeforeLatestFill(1)).toBe(5);
    });
  });

  describe('getHistoryRatings', () => {
    it('returns per-day ratings map for the requested window, oldest days without data omitted', async () => {
      const prisma = makePrisma();
      prisma.rating.findMany.mockResolvedValue([
        { date: d(0), needId: 'attachment', value: 7 },
        { date: d(0), needId: 'autonomy', value: 4 },
        { date: d(2), needId: 'limits', value: 9 },
      ]);
      const svc = new BotAnalyticsService(prisma);
      const history = await svc.getHistoryRatings(1, 3);
      expect(history).toHaveLength(2); // d(1) has no data → omitted
      const today = history.find((h) => h.date === d(0))!;
      expect(today.ratings).toEqual({ attachment: 7, autonomy: 4 });
    });

    it('returns empty array with no ratings in the window', async () => {
      const svc = new BotAnalyticsService(makePrisma());
      expect(await svc.getHistoryRatings(1, 5)).toEqual([]);
    });
  });

  describe('getTotalDaysFilled', () => {
    it('returns count of distinct fill days', async () => {
      const prisma = makePrisma();
      prisma.rating.findMany.mockResolvedValue([
        { date: d(0) },
        { date: d(3) },
        { date: d(9) },
      ]);
      const svc = new BotAnalyticsService(prisma);
      expect(await svc.getTotalDaysFilled(1)).toBe(3);
    });

    it('returns 0 with no ratings', async () => {
      const svc = new BotAnalyticsService(makePrisma());
      expect(await svc.getTotalDaysFilled(1)).toBe(0);
    });
  });

  describe('getLowStreakNeeds', () => {
    it('returns needs below threshold for every one of the last N days', async () => {
      const prisma = makePrisma();
      prisma.rating.findMany.mockResolvedValue([
        { needId: 'attachment', date: d(0), value: 2 },
        { needId: 'attachment', date: d(1), value: 3 },
        { needId: 'autonomy', date: d(0), value: 8 },
        { needId: 'autonomy', date: d(1), value: 9 },
      ]);
      const svc = new BotAnalyticsService(prisma);
      const low = await svc.getLowStreakNeeds(1, 5, 2);
      expect(low).toEqual(['attachment']);
    });

    it('a need missing a row on any of the N days is excluded (not a full streak)', async () => {
      const prisma = makePrisma();
      prisma.rating.findMany.mockResolvedValue([
        { needId: 'attachment', date: d(0), value: 1 },
        // no row for d(1) — streak incomplete
      ]);
      const svc = new BotAnalyticsService(prisma);
      expect(await svc.getLowStreakNeeds(1, 5, 2)).toEqual([]);
    });

    it('returns empty array with no data', async () => {
      const svc = new BotAnalyticsService(makePrisma());
      expect(await svc.getLowStreakNeeds(1, 5, 3)).toEqual([]);
    });
  });

  describe('getProfileInsight', () => {
    it('returns null with no ratings', async () => {
      const svc = new BotAnalyticsService(makePrisma());
      expect(await svc.getProfileInsight(1)).toBeNull();
    });

    it('returns null when fewer than 5 distinct days filled', async () => {
      const prisma = makePrisma();
      prisma.rating.findMany.mockResolvedValue([
        { date: d(0), needId: 'attachment', value: 5 },
        { date: d(1), needId: 'attachment', value: 5 },
      ]);
      const svc = new BotAnalyticsService(prisma);
      expect(await svc.getProfileInsight(1)).toBeNull();
    });

    it('returns null when no need has ≥3 data points even with ≥5 days', async () => {
      const prisma = makePrisma();
      // 5 distinct days, but each of 5 needs appears only once → n<3 for all
      prisma.rating.findMany.mockResolvedValue(
        Array.from({ length: 5 }, (_, i) => ({
          date: d(i),
          needId: 'attachment',
          value: 5,
        })).map((r, i) => ({ ...r, needId: `need${i}` as any })),
      );
      const svc = new BotAnalyticsService(prisma);
      expect(await svc.getProfileInsight(1)).toBeNull();
    });

    it('computes strongest/weakest need averages over ≥3 occurrences', async () => {
      const prisma = makePrisma();
      const rows: any[] = [];
      for (let i = 0; i < 5; i++) {
        rows.push({ date: d(i), needId: 'attachment', value: 9 });
        rows.push({ date: d(i), needId: 'limits', value: 2 });
      }
      prisma.rating.findMany.mockResolvedValue(rows);
      const svc = new BotAnalyticsService(prisma);
      const insight = await svc.getProfileInsight(1);
      expect(insight).not.toBeNull();
      expect(insight!.totalDays).toBe(5);
      expect(insight!.strongest).toBe('attachment');
      expect(insight!.strongestAvg).toBeCloseTo(9);
      expect(insight!.weakest).toBe('limits');
      expect(insight!.weakestAvg).toBeCloseTo(2);
    });
  });

  describe('recordActivity', () => {
    it('upserts AppActivity for today in the user local timezone', async () => {
      const prisma = makePrisma();
      const svc = new BotAnalyticsService(prisma);
      const result = await svc.recordActivity(1);
      expect(result).toEqual({ ok: true });
      expect(prisma.appActivity.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_date: { userId: 1, date: d(0) } },
        }),
      );
    });
  });

  describe('getStreakData', () => {
    it('empty history → all zeros, todayDone false', async () => {
      const svc = new BotAnalyticsService(makePrisma());
      const streak = await svc.getStreakData(1);
      expect(streak.currentStreak).toBe(0);
      expect(streak.longestStreak).toBe(0);
      expect(streak.totalDays).toBe(0);
      expect(streak.todayDone).toBe(false);
      expect(streak.weekDots.length).toBe(7);
    });

    it('single active date → longest streak 1 (covers single-date branch)', async () => {
      const prisma = makePrisma({
        rating: { findMany: jest.fn().mockResolvedValue([{ date: d(0) }]) },
      });
      const svc = new BotAnalyticsService(prisma);
      const streak = await svc.getStreakData(1);
      expect(streak.currentStreak).toBe(1);
      expect(streak.longestStreak).toBe(1);
      expect(streak.todayDone).toBe(true);
    });

    it('today not filled yet → current streak counts back from yesterday', async () => {
      const prisma = makePrisma({
        rating: {
          findMany: jest
            .fn()
            .mockResolvedValue([{ date: d(1) }, { date: d(2) }]),
        },
      });
      const svc = new BotAnalyticsService(prisma);
      const streak = await svc.getStreakData(1);
      expect(streak.todayDone).toBe(false);
      expect(streak.currentStreak).toBe(2);
    });

    it('a gap in the middle keeps the longest streak higher than the current one', async () => {
      const prisma = makePrisma({
        rating: {
          findMany: jest.fn().mockResolvedValue([
            { date: d(0) }, // today, current streak
            { date: d(6) },
            { date: d(7) },
            { date: d(8) }, // an older 3-day run, longer than current
          ]),
        },
      });
      const svc = new BotAnalyticsService(prisma);
      const streak = await svc.getStreakData(1);
      expect(streak.currentStreak).toBe(1);
      expect(streak.longestStreak).toBe(3);
    });
  });

  describe('getAchievements', () => {
    it('на пустой истории — только базовые ачивки не earned', async () => {
      const svc = new BotAnalyticsService(makePrisma());
      const achievements = await svc.getAchievements(1);
      expect(achievements.find((a) => a.id === 'first_day')!.earned).toBe(
        false,
      );
      expect(achievements.find((a) => a.id === 'high_day')!.earned).toBe(false);
    });

    it('высокий день (все 5 потребностей ≥7, среднее ≥8) даёт high_day и all_above7', async () => {
      const rows = NEED_ID_LIST.map((needId) => ({
        date: d(0),
        needId,
        value: 9,
      }));
      const prisma = makePrisma({
        rating: { findMany: jest.fn().mockResolvedValue(rows) },
      });
      const svc = new BotAnalyticsService(prisma);
      const achievements = await svc.getAchievements(1);
      expect(achievements.find((a) => a.id === 'high_day')!.earned).toBe(true);
      expect(achievements.find((a) => a.id === 'all_above7')!.earned).toBe(
        true,
      );
      expect(achievements.find((a) => a.id === 'first_day')!.earned).toBe(true);
    });

    it('перерыв ≥3 дня между заполнениями даёт comeback', async () => {
      const rows = [
        { date: d(10), needId: 'attachment', value: 5 },
        { date: d(0), needId: 'attachment', value: 5 }, // 10-day gap
      ];
      const prisma = makePrisma({
        rating: { findMany: jest.fn().mockResolvedValue(rows) },
      });
      const svc = new BotAnalyticsService(prisma);
      const achievements = await svc.getAchievements(1);
      expect(achievements.find((a) => a.id === 'comeback')!.earned).toBe(true);
    });

    it('рост среднего значения потребности ≥3 за последнюю неделю даёт growth', async () => {
      const rows = [
        { date: d(0), needId: 'attachment', value: 9 }, // recent week
        { date: d(8), needId: 'attachment', value: 2 }, // prior week
      ];
      const prisma = makePrisma({
        rating: { findMany: jest.fn().mockResolvedValue(rows) },
      });
      const svc = new BotAnalyticsService(prisma);
      const achievements = await svc.getAchievements(1);
      expect(achievements.find((a) => a.id === 'growth')!.earned).toBe(true);
    });

    it('streak/total-based ачивки считаются от getStreakData/totalDays', async () => {
      const rows = Array.from({ length: 10 }, (_, i) => ({
        date: d(i),
        needId: 'attachment',
        value: 5,
      }));
      const prisma = makePrisma({
        rating: { findMany: jest.fn().mockResolvedValue(rows) },
      });
      const svc = new BotAnalyticsService(prisma);
      const achievements = await svc.getAchievements(1);
      expect(achievements.find((a) => a.id === 'streak_3')!.earned).toBe(true);
      expect(achievements.find((a) => a.id === 'streak_7')!.earned).toBe(true);
      expect(achievements.find((a) => a.id === 'streak_14')!.earned).toBe(
        false,
      );
      expect(achievements.find((a) => a.id === 'total_10')!.earned).toBe(true);
      expect(achievements.find((a) => a.id === 'total_50')!.earned).toBe(false);
    });
  });

  describe('getWorstDayOfWeek', () => {
    it('returns null with no data', async () => {
      const svc = new BotAnalyticsService(makePrisma());
      expect(await svc.getWorstDayOfWeek(1)).toBeNull();
    });

    it('returns null with fewer than 3 distinct days of week', async () => {
      const prisma = makePrisma();
      prisma.rating.findMany.mockResolvedValue([
        { date: d(0), value: 1 },
        { date: d(7), value: 1 }, // same weekday as d(0) — only 1 distinct dow
      ]);
      const svc = new BotAnalyticsService(prisma);
      expect(await svc.getWorstDayOfWeek(1)).toBeNull();
    });

    it('returns the day name with the lowest average (needs 3 distinct days of week)', async () => {
      const prisma = makePrisma();
      // d(0)=среда, d(1)=вторник, d(2)=понедельник
      prisma.rating.findMany.mockResolvedValue([
        { date: d(0), value: 9 },
        { date: d(1), value: 8 },
        { date: d(2), value: 1 }, // lowest → worst day
      ]);
      const svc = new BotAnalyticsService(prisma);
      expect(await svc.getWorstDayOfWeek(1)).toBe('понедельник');
    });
  });

  describe('getRetentionStats', () => {
    it('собирает когорты D1/D7/D30 и воронку онбординга за последние 30 дней', async () => {
      const prisma = makePrisma({
        user: {
          count: jest.fn(({ where }: any) =>
            Promise.resolve(where.disclaimerAccepted ? 30 : 50),
          ),
        },
        $queryRaw: makeQueryRawMock({
          cohortPoint: (n) =>
            n === 1
              ? { cohort: 10, retained: 4 }
              : n === 7
                ? { cohort: 20, retained: 6 }
                : { cohort: 15, retained: 2 },
          filledOnce30: 25,
        }),
      });
      const svc = new BotAnalyticsService(prisma);
      const stats = await svc.getRetentionStats();
      expect(stats.d1).toEqual({ cohort: 10, retained: 4 });
      expect(stats.d7).toEqual({ cohort: 20, retained: 6 });
      expect(stats.d30).toEqual({ cohort: 15, retained: 2 });
      expect(stats.funnel).toEqual({
        registered30: 50,
        consented30: 30,
        filledOnce30: 25,
      });
    });
  });

  describe('getAdminStats', () => {
    it('собирает полный отчёт /stats без падений на населённых данных', async () => {
      const ago7 = new Date(FIXED_DATE.getTime() - 7 * 86_400_000);
      const ago30 = new Date(FIXED_DATE.getTime() - 30 * 86_400_000);
      const prisma = makePrisma({
        user: {
          count: jest.fn(({ where }: any) => {
            if (where.notifyEnabled === false) return Promise.resolve(3);
            if (where.botBlockedAt) return Promise.resolve(2);
            if (where.createdAt?.gte?.getTime() === ago7.getTime())
              return Promise.resolve(5);
            if (where.createdAt?.gte?.getTime() === ago30.getTime())
              return Promise.resolve(12);
            if (where.disclaimerAccepted) return Promise.resolve(8);
            if (where.createdAt) return Promise.resolve(20); // registered30
            return Promise.resolve(100); // totalUsers
          }),
        },
        pair: { count: jest.fn().mockResolvedValue(4) },
        rating: {
          findMany: jest.fn(({ distinct }: any) => {
            if (distinct?.includes('date'))
              return Promise.resolve([
                { date: d(0), userId: 1n },
                { date: d(1), userId: 2n },
              ]);
            return Promise.resolve([{ userId: 1n }, { userId: 3n }]);
          }),
          groupBy: jest.fn().mockResolvedValue([
            { needId: 'limits', _avg: { value: 3.2 } },
            { needId: 'attachment', _avg: { value: 7.1 } },
          ]),
        },
        $queryRaw: makeQueryRawMock({
          todayCount: 7,
          month30Count: 40,
          ret1: 60,
          ret3: 30,
          ret7: 15,
          ret30: 5,
          cohortPoint: () => ({ cohort: 10, retained: 3 }),
          filledOnce30: 18,
        }),
      });
      const svc = new BotAnalyticsService(prisma);
      const report = await svc.getAdminStats();
      expect(typeof report).toBe('string');
      expect(report).toContain('Всего людей: 100');
      expect(report).toContain('Выключили напоминания: 3');
      expect(report).toContain('Сейчас вместе: 4');
      // getAdminStats дописывает retention-блок (getRetentionStats)
      expect(report.length).toBeGreaterThan(200);
    });

    it('на пустой БД не падает и не показывает NaN/undefined (правило №8 CLAUDE.md)', async () => {
      const svc = new BotAnalyticsService(makePrisma());
      const report = await svc.getAdminStats();
      expect(report).not.toMatch(/NaN|undefined/);
    });
  });
});

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

    it('returns day name of highest-sum day', async () => {
      const prisma = makePrisma();
      // d(0) = 2025-06-11 = Wednesday (среда)
      prisma.rating.findMany.mockResolvedValue([
        { date: d(0), value: 8 },
        { date: d(0), value: 9 },
        { date: d(1), value: 3 },
      ]);
      const svc = new BotAnalyticsService(prisma);
      expect(await svc.getBestDayOfWeek(1)).toBe('среда');
    });
  });
});

// Волна В mutation-покрытия (2026-08): getAchievements считает comeback
// (перерыв >=3 дня) и growth (рост среднего >=3 балла) через `>=`.
// Существующие тесты (bot.analytics.service.spec.ts) брали разрыв/рост
// далеко от границы (10 дней, +7 баллов) — мутант `>=` → `>` тоже прошёл бы
// эти тесты. Здесь бьём ровно по границе с обеих сторон.
import { BotAnalyticsService } from './bot.analytics.service';

const FIXED_DATE = new Date('2025-06-11T12:00:00Z');

function d(daysAgo: number): string {
  const dt = new Date(FIXED_DATE.getTime() - daysAgo * 86_400_000);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

function makePrisma(
  rows: Array<{ date: string; needId: string; value: number }>,
) {
  return {
    user: {
      findUnique: jest.fn().mockResolvedValue({ notifyTimezone: 'UTC' }),
    },
    rating: { findMany: jest.fn().mockResolvedValue(rows) },
    // getAchievements зовёт getStreakData → getActiveDates, которому нужны
    // ещё 4 источника (см. bot.analytics.service.activedates.spec.ts) —
    // для этих тестов достаточно пустых.
    appActivity: { findMany: jest.fn().mockResolvedValue([]) },
    schemaDiaryEntry: { findMany: jest.fn().mockResolvedValue([]) },
    modeDiaryEntry: { findMany: jest.fn().mockResolvedValue([]) },
    gratitudeDiaryEntry: { findMany: jest.fn().mockResolvedValue([]) },
  } as any;
}

describe('BotAnalyticsService.getAchievements — граница comeback (перерыв >= 3 дня)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(FIXED_DATE);
  });
  afterEach(() => jest.useRealTimers());

  it('перерыв ровно 3 дня — comeback earned', async () => {
    const rows = [
      { date: d(10), needId: 'attachment', value: 5 },
      { date: d(7), needId: 'attachment', value: 5 }, // разница ровно 3 дня
    ];
    const svc = new BotAnalyticsService(makePrisma(rows));
    const achievements = await svc.getAchievements(1n);
    expect(achievements.find((a) => a.id === 'comeback')!.earned).toBe(true);
  });

  it('перерыв 2 дня — comeback НЕ earned (граница снизу)', async () => {
    const rows = [
      { date: d(10), needId: 'attachment', value: 5 },
      { date: d(8), needId: 'attachment', value: 5 }, // разница 2 дня
    ];
    const svc = new BotAnalyticsService(makePrisma(rows));
    const achievements = await svc.getAchievements(1n);
    expect(achievements.find((a) => a.id === 'comeback')!.earned).toBe(false);
  });
});

describe('BotAnalyticsService.getAchievements — граница growth (рост среднего >= 3 балла)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(FIXED_DATE);
  });
  afterEach(() => jest.useRealTimers());

  it('рост ровно на 3 балла (5→8) — growth earned', async () => {
    const rows = [
      { date: d(0), needId: 'attachment', value: 8 }, // recent (last 7 days)
      { date: d(8), needId: 'attachment', value: 5 }, // prior week
    ];
    const svc = new BotAnalyticsService(makePrisma(rows));
    const achievements = await svc.getAchievements(1n);
    expect(achievements.find((a) => a.id === 'growth')!.earned).toBe(true);
  });

  it('рост на 2.9 балла — growth НЕ earned (граница снизу)', async () => {
    const rows = [
      { date: d(0), needId: 'attachment', value: 7.9 },
      { date: d(8), needId: 'attachment', value: 5 },
    ];
    const svc = new BotAnalyticsService(makePrisma(rows));
    const achievements = await svc.getAchievements(1n);
    expect(achievements.find((a) => a.id === 'growth')!.earned).toBe(false);
  });
});

describe('BotAnalyticsService.getProfileInsight — единственная потребность с >=3 наблюдениями', () => {
  it('одна потребность с 3 занесениями — strongest и weakest совпадают и равны её среднему', async () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({
      date: d(i),
      needId: 'attachment',
      value: 6,
    }));
    const svc = new BotAnalyticsService(makePrisma(rows));
    const insight = await svc.getProfileInsight(1n);
    expect(insight).not.toBeNull();
    expect(insight!.strongest).toBe('attachment');
    expect(insight!.weakest).toBe('attachment');
    expect(insight!.strongestAvg).toBe(6);
    expect(insight!.weakestAvg).toBe(6);
  });

  it('потребность ровно с 3 наблюдениями участвует в расчёте (граница n>=3, не >3)', async () => {
    const rows = [
      ...Array.from({ length: 5 }, (_, i) => ({
        date: d(i),
        needId: 'attachment',
        value: 9,
      })),
      // limits встречается ровно 3 раза — граница включения
      { date: d(0), needId: 'limits', value: 1 },
      { date: d(1), needId: 'limits', value: 1 },
      { date: d(2), needId: 'limits', value: 1 },
    ];
    const svc = new BotAnalyticsService(makePrisma(rows));
    const insight = await svc.getProfileInsight(1n);
    expect(insight!.weakest).toBe('limits');
    expect(insight!.weakestAvg).toBe(1);
  });
});

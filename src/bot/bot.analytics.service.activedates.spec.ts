// Волна В mutation-покрытия (2026-08): getActiveDates (приватный) объединяет
// ПЯТЬ источников активности — rating, appActivity, schemaDiaryEntry,
// modeDiaryEntry, gratitudeDiaryEntry. Все существующие тесты getStreakData
// кормили только rating — источники diary/appActivity ни разу не были
// единственным источником данных, поэтому мутант, вырезающий один из них
// из Promise.all/объединения Set, прошёл бы незамеченным.
import { BotAnalyticsService } from './bot.analytics.service';

const FIXED_DATE = new Date('2025-06-11T12:00:00Z'); // среда, UTC

function emptyPrisma(overrides: Record<string, any> = {}) {
  return {
    user: {
      findUnique: jest.fn().mockResolvedValue({ notifyTimezone: 'UTC' }),
    },
    rating: { findMany: jest.fn().mockResolvedValue([]) },
    appActivity: { findMany: jest.fn().mockResolvedValue([]) },
    schemaDiaryEntry: { findMany: jest.fn().mockResolvedValue([]) },
    modeDiaryEntry: { findMany: jest.fn().mockResolvedValue([]) },
    gratitudeDiaryEntry: { findMany: jest.fn().mockResolvedValue([]) },
    ...overrides,
  } as any;
}

describe('BotAnalyticsService.getStreakData — каждый источник getActiveDates учитывается по отдельности', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(FIXED_DATE);
  });
  afterEach(() => jest.useRealTimers());

  it('только appActivity (без rating) — день засчитан как заполненный', async () => {
    const prisma = emptyPrisma({
      appActivity: {
        findMany: jest.fn().mockResolvedValue([{ date: '2025-06-11' }]),
      },
    });
    const svc = new BotAnalyticsService(prisma);
    const { todayDone, totalDays } = await svc.getStreakData(1n);
    expect(todayDone).toBe(true);
    expect(totalDays).toBe(1);
  });

  it('только schemaDiaryEntry (createdAt в UTC) — конвертируется в локальную дату и засчитывается', async () => {
    const prisma = emptyPrisma({
      schemaDiaryEntry: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ createdAt: new Date('2025-06-11T08:00:00Z') }]),
      },
    });
    const svc = new BotAnalyticsService(prisma);
    const { todayDone } = await svc.getStreakData(1n);
    expect(todayDone).toBe(true);
  });

  it('только modeDiaryEntry — тоже отдельный источник, а не потерянная ветка', async () => {
    const prisma = emptyPrisma({
      modeDiaryEntry: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ createdAt: new Date('2025-06-11T08:00:00Z') }]),
      },
    });
    const svc = new BotAnalyticsService(prisma);
    const { todayDone } = await svc.getStreakData(1n);
    expect(todayDone).toBe(true);
  });

  it('только gratitudeDiaryEntry — тоже отдельный источник', async () => {
    const prisma = emptyPrisma({
      gratitudeDiaryEntry: {
        findMany: jest.fn().mockResolvedValue([{ date: '2025-06-11' }]),
      },
    });
    const svc = new BotAnalyticsService(prisma);
    const { todayDone } = await svc.getStreakData(1n);
    expect(todayDone).toBe(true);
  });

  it('все 5 источников на разные дни объединяются в один Set без потерь (totalDays = 5)', async () => {
    const prisma = emptyPrisma({
      rating: {
        findMany: jest.fn().mockResolvedValue([{ date: '2025-06-11' }]),
      },
      appActivity: {
        findMany: jest.fn().mockResolvedValue([{ date: '2025-06-10' }]),
      },
      schemaDiaryEntry: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ createdAt: new Date('2025-06-09T08:00:00Z') }]),
      },
      modeDiaryEntry: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ createdAt: new Date('2025-06-08T08:00:00Z') }]),
      },
      gratitudeDiaryEntry: {
        findMany: jest.fn().mockResolvedValue([{ date: '2025-06-07' }]),
      },
    });
    const svc = new BotAnalyticsService(prisma);
    const { totalDays } = await svc.getStreakData(1n);
    expect(totalDays).toBe(5);
  });

  it('одна и та же дата из двух источников не задваивается (Set, не массив)', async () => {
    const prisma = emptyPrisma({
      rating: {
        findMany: jest.fn().mockResolvedValue([{ date: '2025-06-11' }]),
      },
      appActivity: {
        findMany: jest.fn().mockResolvedValue([{ date: '2025-06-11' }]),
      },
    });
    const svc = new BotAnalyticsService(prisma);
    const { totalDays } = await svc.getStreakData(1n);
    expect(totalDays).toBe(1);
  });
});

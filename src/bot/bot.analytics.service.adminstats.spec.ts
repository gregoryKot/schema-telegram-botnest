// Волна В mutation-покрытия (2026-08): getAdminStats уже гонялся «целиком»
// в bot.analytics.service.spec.ts, но churnRisk (разница множеств
// activeOlder/activeRecent) и bestDow (подсчёт по дню недели) не проверялись
// на КОНКРЕТНОЕ число — мутант, ломающий именно эту арифметику, проходил бы
// незамеченным. Плюс граница «нужно ≥3 разных дней недели» для best/worst.
import { BotAnalyticsService } from './bot.analytics.service';

const FIXED_DATE = new Date('2025-06-11T12:00:00Z'); // среда

function d(daysAgo: number): string {
  const dt = new Date(FIXED_DATE.getTime() - daysAgo * 86_400_000);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

function makeQueryRawMock(
  cfg: { todayCount?: number; month30Count?: number } = {},
) {
  return jest.fn((strings: TemplateStringsArray) => {
    const text = strings.join('|');
    if (text.includes('AS cohort'))
      return Promise.resolve([{ cohort: 0n, retained: 0n }]);
    if (text.includes('EXISTS (SELECT 1 FROM "Rating" r'))
      return Promise.resolve([{ c: 0n }]);
    if (text.includes('WHERE date = '))
      return Promise.resolve([{ c: BigInt(cfg.todayCount ?? 0) }]);
    if (text.includes('WHERE date >= '))
      return Promise.resolve([{ c: BigInt(cfg.month30Count ?? 0) }]);
    return Promise.resolve([{ cnt: 0n }]); // ret1/ret3/ret7/ret30
  });
}

// activeOlder = { userId: 3, 5 } (заходили в окне d30..d7)
// activeRecent = { userId: 3 } (заходили за последние 7 дней)
// churnRisk = |activeOlder \ activeRecent| = |{5}| = 1
function makePrismaForChurnAndDow() {
  const fillsByDow = [
    { date: d(2), userId: 1n }, // понедельник
    { date: d(2), userId: 2n }, // понедельник
    { date: d(9), userId: 3n }, // тоже понедельник (d(9) = 2025-06-02, пн)
    { date: d(0), userId: 4n }, // среда — меньшинство
  ];
  return {
    user: { count: jest.fn().mockResolvedValue(0) },
    pair: { count: jest.fn().mockResolvedValue(0) },
    rating: {
      findMany: jest.fn(({ where, distinct }: any) => {
        if (where.date?.lt !== undefined)
          return Promise.resolve([{ userId: 3n }, { userId: 5n }]); // activeOlder
        if (distinct?.includes('date')) return Promise.resolve(fillsByDow); // fillsByDow
        return Promise.resolve([{ userId: 3n }]); // week7Ratings (activeRecent)
      }),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    $queryRaw: makeQueryRawMock(),
  } as any;
}

describe('BotAnalyticsService.getAdminStats — churnRisk и bestDow (арифметика отчёта)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(FIXED_DATE);
  });
  afterEach(() => jest.useRealTimers());

  it('churnRisk считает разницу множеств (был в d30..d7, но не в последние 7 дней), а не пересечение/сумму', async () => {
    const svc = new BotAnalyticsService(makePrismaForChurnAndDow());
    const report = await svc.getAdminStats();
    expect(report).toContain(
      'Могут уйти (заходили раньше, а всю неделю — ни разу): 1',
    );
  });

  it('bestDow — день недели с максимумом заполнений (понедельник: 3 против 1 у среды)', async () => {
    const svc = new BotAnalyticsService(makePrismaForChurnAndDow());
    const report = await svc.getAdminStats();
    expect(report).toContain('Чаще всего заполняют: пн');
  });
});

describe('BotAnalyticsService.getAdminStats — fillRate = Math.round(todayCount/month30Count*100)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(FIXED_DATE);
  });
  afterEach(() => jest.useRealTimers());

  it('7/40 = 17.5% → округляется в 18, а не отбрасывается до 17 (не Math.floor)', async () => {
    const prisma = makePrismaForChurnAndDow();
    prisma.$queryRaw = makeQueryRawMock({ todayCount: 7, month30Count: 40 });
    const svc = new BotAnalyticsService(prisma);
    const report = await svc.getAdminStats();
    expect(report).toContain(
      'Заполнили сегодня: 7 (это 18% от тех, кто заходил за месяц)',
    );
  });

  it('month30Count = 0 → fillRate = 0, а не деление на ноль/NaN', async () => {
    const prisma = makePrismaForChurnAndDow();
    prisma.$queryRaw = makeQueryRawMock({ todayCount: 0, month30Count: 0 });
    const svc = new BotAnalyticsService(prisma);
    const report = await svc.getAdminStats();
    expect(report).toContain(
      'Заполнили сегодня: 0 (это 0% от тех, кто заходил за месяц)',
    );
  });
});

describe('BotAnalyticsService.getBestDayOfWeek / getWorstDayOfWeek — граница «≥3 разных дней недели»', () => {
  it('ровно 3 разных дня недели — уже достаточно для ответа (не null)', async () => {
    const prisma: any = {
      rating: {
        findMany: jest.fn().mockResolvedValue([
          { date: d(0), value: 9 }, // среда
          { date: d(1), value: 1 }, // вторник
          { date: d(2), value: 5 }, // понедельник
        ]),
      },
    };
    jest.useFakeTimers();
    jest.setSystemTime(FIXED_DATE);
    const svc = new BotAnalyticsService(prisma);
    expect(await svc.getBestDayOfWeek(1)).toBe('среда');
    expect(await svc.getWorstDayOfWeek(1)).toBe('вторник');
    jest.useRealTimers();
  });

  it('всего 2 разных дня недели — недостаточно данных, обе функции возвращают null', async () => {
    const prisma: any = {
      rating: {
        findMany: jest.fn().mockResolvedValue([
          { date: d(0), value: 9 }, // среда
          { date: d(1), value: 1 }, // вторник
        ]),
      },
    };
    const svc = new BotAnalyticsService(prisma);
    expect(await svc.getBestDayOfWeek(1)).toBeNull();
    expect(await svc.getWorstDayOfWeek(1)).toBeNull();
  });
});

describe('BotAnalyticsService.getStreakData — weekDots (текущая неделя пн–вс, будущее = false)', () => {
  it('среда — заполнены пн/ср, будущие дни (чт..вс) всегда false вне зависимости от данных', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(FIXED_DATE); // среда, 2025-06-11
    const prisma: any = {
      rating: {
        findMany: jest.fn().mockResolvedValue([{ date: d(2) }, { date: d(0) }]), // пн и ср
      },
      appActivity: { findMany: jest.fn().mockResolvedValue([]) },
      schemaDiaryEntry: { findMany: jest.fn().mockResolvedValue([]) },
      modeDiaryEntry: { findMany: jest.fn().mockResolvedValue([]) },
      gratitudeDiaryEntry: { findMany: jest.fn().mockResolvedValue([]) },
      user: {
        findUnique: jest.fn().mockResolvedValue({ notifyTimezone: 'UTC' }),
      },
    };
    const svc = new BotAnalyticsService(prisma);
    const { weekDots } = await svc.getStreakData(1n);
    // индексы 0=пн..6=вс: пн(0)=true, вт(1)=false, ср(2)=true, дальше — будущее
    expect(weekDots).toEqual([true, false, true, false, false, false, false]);
    jest.useRealTimers();
  });
});

// Волна В mutation-покрытия (2026-08): getAdminStats уже гонялся «целиком»
// в bot.analytics.service.spec.ts (сейчас — этот файл, сервис вынесен по
// правилу №10), но churnRisk (разница множеств activeOlder/activeRecent) и
// bestDow (подсчёт по дню недели) не проверялись на КОНКРЕТНОЕ число —
// мутант, ломающий именно эту арифметику, проходил бы незамеченным.
import { BotAdminStatsService } from './bot.admin-stats.service';

const FIXED_DATE = new Date('2025-06-11T12:00:00Z'); // среда

function d(daysAgo: number): string {
  const dt = new Date(FIXED_DATE.getTime() - daysAgo * 86_400_000);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

// $queryRaw в сервисе — несколько разных сырых запросов (getAdminStats и
// getRetentionStats). Тег-функция разбирает шаблон-строку и по узнаваемому
// фрагменту SQL решает, что вернуть, вместо хрупкой привязки к порядку
// вызовов внутри Promise.all.
function makeQueryRawMock(
  cfg: {
    todayCount?: number;
    month30Count?: number;
    cohortPoint?: (n: number) => { cohort: number; retained: number };
    filledOnce30?: number;
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
    if (text.includes('EXISTS (SELECT 1 FROM "Rating" r'))
      return Promise.resolve([{ c: BigInt(cfg.filledOnce30 ?? 0) }]);
    if (text.includes('WHERE date = '))
      return Promise.resolve([{ c: BigInt(cfg.todayCount ?? 0) }]);
    if (text.includes('WHERE date >= '))
      return Promise.resolve([{ c: BigInt(cfg.month30Count ?? 0) }]);
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

// Пустые дефолты по всем таблицам, которые читает админ-отчёт: тест
// переопределяет только то, что проверяет.
function makePrisma(overrides: Record<string, any> = {}) {
  return {
    user: {
      count: jest.fn().mockResolvedValue(0),
      ...overrides.user,
    },
    pair: {
      count: jest.fn().mockResolvedValue(0),
      ...overrides.pair,
    },
    rating: {
      findMany: jest.fn().mockResolvedValue([]),
      groupBy: jest.fn().mockResolvedValue([]),
      ...overrides.rating,
    },
    $queryRaw: overrides.$queryRaw ?? makeQueryRawMock(),
  } as any;
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

describe('BotAdminStatsService.getAdminStats — churnRisk и bestDow (арифметика отчёта)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(FIXED_DATE);
  });
  afterEach(() => jest.useRealTimers());

  it('churnRisk считает разницу множеств (был в d30..d7, но не в последние 7 дней), а не пересечение/сумму', async () => {
    const svc = new BotAdminStatsService(makePrismaForChurnAndDow());
    const report = await svc.getAdminStats();
    expect(report).toContain(
      'Могут уйти (заходили раньше, а всю неделю — ни разу): 1',
    );
  });

  it('bestDow — день недели с максимумом заполнений (понедельник: 3 против 1 у среды)', async () => {
    const svc = new BotAdminStatsService(makePrismaForChurnAndDow());
    const report = await svc.getAdminStats();
    expect(report).toContain('Чаще всего заполняют: пн');
  });

  it('ядро: считает того, кто набрал 3 дня ВНУТРИ окна недели, но не того, чьи 3 дня старше окна (fillsByDow тянет 30 дней, окно ядра — 7)', async () => {
    const prisma = makePrismaForChurnAndDow();
    prisma.rating.findMany = jest.fn(({ where, distinct }: any) => {
      if (where.date?.lt !== undefined)
        return Promise.resolve([{ userId: 3n }, { userId: 5n }]); // activeOlder
      if (distinct?.includes('date'))
        return Promise.resolve([
          { userId: 10n, date: d(1) },
          { userId: 10n, date: d(2) },
          { userId: 10n, date: d(3) }, // 3 разных дня внутри недели → ядро
          { userId: 20n, date: d(9) },
          { userId: 20n, date: d(10) },
          { userId: 20n, date: d(11) }, // 3 дня, но все старше окна недели → не ядро
          { userId: 30n, date: d(0) },
          { userId: 30n, date: d(1) }, // только 2 дня внутри окна → не ядро
        ]);
      return Promise.resolve([
        { userId: 10n },
        { userId: 20n },
        { userId: 30n },
      ]); // week7Ratings
    });
    const svc = new BotAdminStatsService(prisma);
    const report = await svc.getAdminStats();
    expect(report).toContain(
      'Ведут дневник регулярно (хотя бы 3 дня из последних 7): 1 из 3 заходивших за неделю',
    );
  });
});

describe('BotAdminStatsService.getAdminStats — fillRate = Math.round(todayCount/month30Count*100)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(FIXED_DATE);
  });
  afterEach(() => jest.useRealTimers());

  it('7/40 = 17.5% → округляется в 18, а не отбрасывается до 17 (не Math.floor)', async () => {
    const prisma = makePrismaForChurnAndDow();
    prisma.$queryRaw = makeQueryRawMock({ todayCount: 7, month30Count: 40 });
    const svc = new BotAdminStatsService(prisma);
    const report = await svc.getAdminStats();
    expect(report).toContain(
      'Заполнили сегодня: 7 (это 18% от тех, кто заходил за месяц)',
    );
  });

  it('month30Count = 0 → fillRate = 0, а не деление на ноль/NaN', async () => {
    const prisma = makePrismaForChurnAndDow();
    prisma.$queryRaw = makeQueryRawMock({ todayCount: 0, month30Count: 0 });
    const svc = new BotAdminStatsService(prisma);
    const report = await svc.getAdminStats();
    expect(report).toContain(
      'Заполнили сегодня: 0 (это 0% от тех, кто заходил за месяц)',
    );
  });
});

// Три блока ниже переехали сюда вместе с методами из
// bot.analytics.service.spec.ts (правило №10, вынос сервиса): они проверяют
// getRetentionStats/getAdminStats, то есть теперь — этот сервис.
describe('BotAdminStatsService.getRetentionStats', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(FIXED_DATE);
  });
  afterEach(() => jest.useRealTimers());

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
    const svc = new BotAdminStatsService(prisma);
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

describe('BotAdminStatsService.getAdminStats — отчёт целиком', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(FIXED_DATE);
  });
  afterEach(() => jest.useRealTimers());

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
    const svc = new BotAdminStatsService(prisma);
    const report = await svc.getAdminStats();
    expect(typeof report).toBe('string');
    expect(report).toContain('Всего людей: 100');
    expect(report).toContain('Выключили напоминания: 3');
    expect(report).toContain('Сейчас вместе: 4');
    // getAdminStats дописывает retention-блок (getRetentionStats)
    expect(report.length).toBeGreaterThan(200);
  });

  it('на пустой БД не падает и не показывает NaN/undefined (правило №8 CLAUDE.md)', async () => {
    const svc = new BotAdminStatsService(makePrisma());
    const report = await svc.getAdminStats();
    expect(report).not.toMatch(/NaN|undefined/);
  });
});

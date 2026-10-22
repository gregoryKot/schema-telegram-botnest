// Волна В mutation-покрытия (2026-08): числа отчёта проверяются на КОНКРЕТНОЕ
// значение, а не «собралось без падения».
//
// Аудит 2026-10: «ядро», «заходили за неделю» и «могут уйти» считались в
// памяти по findMany с take: 5000 и теряли свежие дни. Теперь их считает один
// SQL — его арифметику (churn, ядро, >5000 пар) доказывает живая база
// (test/raw-sql-live-admin-stats.e2e-spec.ts, правило №18); здесь — что числа
// из SQL доходят до отчёта, день недели, зона «сегодня» и пустое состояние.
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
    activity?: {
      month30?: number;
      week7?: number;
      churn?: number;
      core?: number;
    };
    perDay?: Array<{ date: string; c: number }>;
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
    if (text.includes('AS last_day')) {
      const a = cfg.activity ?? {};
      return Promise.resolve([
        {
          month30: BigInt(a.month30 ?? cfg.month30Count ?? 0),
          week7: BigInt(a.week7 ?? 0),
          churn: BigInt(a.churn ?? 0),
          core: BigInt(a.core ?? 0),
        },
      ]);
    }
    if (text.includes('GROUP BY date'))
      return Promise.resolve(
        (cfg.perDay ?? []).map((r) => ({ date: r.date, c: BigInt(r.c) })),
      );
    if (text.includes('EXISTS (SELECT 1 FROM "Rating" r'))
      return Promise.resolve([{ c: BigInt(cfg.filledOnce30 ?? 0) }]);
    if (text.includes('WHERE date = '))
      return Promise.resolve([{ c: BigInt(cfg.todayCount ?? 0) }]);
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
      groupBy: jest.fn().mockResolvedValue([]),
      ...overrides.rating,
    },
    $queryRaw: overrides.$queryRaw ?? makeQueryRawMock(),
  } as any;
}

describe('BotAdminStatsService.getAdminStats — активность, день недели, зона', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(FIXED_DATE);
  });
  afterEach(() => jest.useRealTimers());

  it('«заходили», «ядро» и «могут уйти» — числа из одного SQL доходят до отчёта как есть', async () => {
    const prisma = makePrisma({
      $queryRaw: makeQueryRawMock({
        activity: { month30: 9, week7: 7, churn: 2, core: 4 },
      }),
    });
    const report = await new BotAdminStatsService(prisma).getAdminStats();
    expect(report).toContain('Заходили за неделю: 7 · за месяц: 9');
    expect(report).toContain(
      'Ведут дневник регулярно (хотя бы 3 дня из последних 7): 4 из 7 заходивших за неделю',
    );
    expect(report).toContain(
      'Могут уйти (заходили раньше, а всю неделю — ни разу): 2',
    );
  });

  it('SQL активности получает окна недели и месяца в МСК, без take и без now()', async () => {
    const queryRaw = makeQueryRawMock();
    await new BotAdminStatsService(
      makePrisma({ $queryRaw: queryRaw }),
    ).getAdminStats();
    const call = queryRaw.mock.calls.find(([strings]) =>
      (strings as TemplateStringsArray).join('|').includes('AS last_day'),
    ) as unknown as [TemplateStringsArray, ...unknown[]];
    const [strings, ...values] = call;
    // FIXED_DATE = 12:00 UTC = 15:00 МСК — дни совпадают с UTC-днями.
    expect(values).toEqual([d(7), d(7), d(7), d(30)]);
    expect(strings.join('|')).not.toMatch(/now\(\)|LIMIT|take/i);
  });

  it('bestDow — день недели с наибольшим числом людей (понедельник: 2+1 против 1 у среды)', async () => {
    const prisma = makePrisma({
      $queryRaw: makeQueryRawMock({
        perDay: [
          { date: d(2), c: 2 }, // 2025-06-09, понедельник
          { date: d(9), c: 1 }, // 2025-06-02, тоже понедельник
          { date: d(0), c: 1 }, // 2025-06-11, среда
        ],
      }),
    });
    const report = await new BotAdminStatsService(prisma).getAdminStats();
    expect(report).toContain('Чаще всего заполняют: пн');
  });

  it('счётчик дня — число людей, а не число строк: один день с 3 людьми весомее двух дней по одному', async () => {
    const prisma = makePrisma({
      $queryRaw: makeQueryRawMock({
        perDay: [
          { date: d(0), c: 3 }, // среда
          { date: d(1), c: 1 }, // вторник
          { date: d(8), c: 1 }, // вторник
        ],
      }),
    });
    const report = await new BotAdminStatsService(prisma).getAdminStats();
    expect(report).toContain('Чаще всего заполняют: ср');
  });

  it('пустая база: день недели не выдумывается («вс» из семи нулей — прежний баг)', async () => {
    const report = await new BotAdminStatsService(makePrisma()).getAdminStats();
    expect(report).toContain(
      'Чаще всего заполняют: пока мало записей, чтобы сказать',
    );
    expect(report).not.toContain('Чаще всего заполняют: вс');
  });

  // Аудит 2026-10: Rating.date пишется в зоне пользователя (по умолчанию
  // МСК), а «сегодня» отчёта бралось в UTC — с 00:00 до 03:00 МСК отчёт
  // показывал вчерашний день и «Заполнили сегодня» считал вчерашних.
  it('01:30 МСК 12 июня — «сегодня» = 2025-06-12, а не UTC-шное 2025-06-11', async () => {
    jest.setSystemTime(new Date('2025-06-11T22:30:00Z'));
    const queryRaw = makeQueryRawMock();
    const report = await new BotAdminStatsService(
      makePrisma({ $queryRaw: queryRaw }),
    ).getAdminStats();
    expect(report).toContain('· 2025-06-12');
    const todayCall = queryRaw.mock.calls.find(([strings]) =>
      (strings as TemplateStringsArray).join('|').includes('WHERE date = '),
    );
    expect(todayCall?.[1]).toBe('2025-06-12');
    const actCall = queryRaw.mock.calls.find(([strings]) =>
      (strings as TemplateStringsArray).join('|').includes('AS last_day'),
    );
    // Неделя назад от 12 июня по МСК — 5 июня, месяц — 13 мая.
    expect(actCall?.[1]).toBe('2025-06-05');
    expect(actCall?.[4]).toBe('2025-05-13');
  });
});

describe('BotAdminStatsService.getAdminStats — fillRate = Math.round(todayCount/month30Count*100)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(FIXED_DATE);
  });
  afterEach(() => jest.useRealTimers());

  it('7/40 = 17.5% → округляется в 18, а не отбрасывается до 17 (не Math.floor)', async () => {
    const prisma = makePrisma({
      $queryRaw: makeQueryRawMock({ todayCount: 7, month30Count: 40 }),
    });
    const svc = new BotAdminStatsService(prisma);
    const report = await svc.getAdminStats();
    expect(report).toContain(
      'Заполнили сегодня: 7 (это 18% от тех, кто заходил за месяц)',
    );
  });

  it('month30Count = 0 → fillRate = 0, а не деление на ноль/NaN', async () => {
    const prisma = makePrisma({
      $queryRaw: makeQueryRawMock({ todayCount: 0, month30Count: 0 }),
    });
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

  // Аудит 2026-10: createdAt — timestamp без зоны, `now()` в SQL зависел от
  // TimeZone сессии Postgres (под Sydney когорта D1 уезжала). Границы — Date
  // из Node; доказательство на живой базе — test/raw-sql-live-stats.e2e-spec.ts.
  it('границы когорты идут Date-параметрами из Node, а не now() из SQL', async () => {
    const queryRaw = makeQueryRawMock();
    const prisma = makePrisma({
      user: { count: jest.fn().mockResolvedValue(0) },
      $queryRaw: queryRaw,
    });
    await new BotAdminStatsService(prisma).getRetentionStats();
    const day = 86_400_000;
    const cohortCalls = queryRaw.mock.calls.filter(([strings]) =>
      (strings as TemplateStringsArray).join('|').includes('AS cohort'),
    );
    expect(cohortCalls).toHaveLength(3);
    for (const [strings, n, from, to] of cohortCalls as unknown as Array<
      [TemplateStringsArray, number, Date, Date]
    >) {
      expect(strings.join('|')).not.toMatch(/now\(\)/i);
      expect(from).toBeInstanceOf(Date);
      expect(to).toBeInstanceOf(Date);
      expect(from.getTime()).toBe(FIXED_DATE.getTime() - (n + 7) * day);
      expect(to.getTime()).toBe(FIXED_DATE.getTime() - n * day);
    }
    expect(
      cohortCalls.map((c) => c[1]).sort((a, b) => Number(a) - Number(b)),
    ).toEqual([1, 7, 30]);
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

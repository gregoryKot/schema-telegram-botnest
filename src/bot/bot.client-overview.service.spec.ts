// Тест батчевого getClientOverviews (аудит 2026-07, N+1-фикс):
// 1) семантика полей идентична старым per-user методам (стрик, давность,
//    история за 14 дней);
// 2) число SQL-запросов не растёт с числом клиентов — ровно 3 на весь список.
import { BotClientOverviewService } from './bot.client-overview.service';

const TZ = 'Europe/Moscow';
// Fixed mid-day Moscow instant — the service derives "today"/"N days ago"
// from Date.now() internally, so a real clock read here is flaky whenever the
// test happens to straddle local midnight relative to the service's own call.
const FIXED_NOW = new Date('2026-07-16T12:00:00+03:00');

const day = (offset: number) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(Date.now() - offset * 86_400_000));

function makePrisma(
  ratings: Array<{
    userId: bigint;
    date: string;
    needId: string;
    value: number;
  }>,
) {
  let queries = 0;
  const prisma: any = {
    user: {
      findMany: jest.fn(({ where }: any) => {
        queries++;
        const ids: bigint[] = where.id.in;
        return Promise.resolve(ids.map((id) => ({ id, notifyTimezone: TZ })));
      }),
    },
    rating: {
      findMany: jest.fn(({ where, distinct }: any) => {
        queries++;
        let rows = ratings.filter((r) => where.userId.in.includes(r.userId));
        if (where.date?.in)
          rows = rows.filter((r) => where.date.in.includes(r.date));
        if (distinct) {
          const seen = new Set<string>();
          rows = rows.filter((r) => {
            const k = `${r.userId}|${r.date}`;
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
          });
        }
        return Promise.resolve(rows);
      }),
    },
    countQueries: () => queries,
  };
  return prisma;
}

describe('BotClientOverviewService.getClientOverviews', () => {
  // Freeze the clock before computing `ratings` below (module-collection time)
  // so the fixture dates and the service's internal Date.now()-based "today"
  // agree for the whole suite — no per-test reset needed since nothing here
  // advances time.
  jest.useFakeTimers();
  jest.setSystemTime(FIXED_NOW);

  afterAll(() => {
    jest.useRealTimers();
  });

  const A = 1n; // стрик 2 дня (сегодня + вчера), заполнял сегодня
  const B = 2n; // последний раз 3 дня назад, стрика нет
  const C = 3n; // никогда не заполнял

  const ratings = [
    ...['attachment', 'autonomy', 'expression', 'play', 'limits'].map(
      (needId) => ({ userId: A, date: day(0), needId, value: 7 }),
    ),
    { userId: A, date: day(1), needId: 'attachment', value: 5 },
    { userId: B, date: day(3), needId: 'play', value: 4 },
  ];

  it('стрик, давность и история совпадают с семантикой per-user методов', async () => {
    const prisma = makePrisma(ratings);
    const svc = new BotClientOverviewService(prisma);
    const map = await svc.getClientOverviews([A, B, C]);

    expect(map.get('1')).toMatchObject({ streak: 2, daysSince: 0 });
    expect(map.get('1')!.history[0]).toEqual({
      date: day(0),
      ratings: {
        attachment: 7,
        autonomy: 7,
        expression: 7,
        play: 7,
        limits: 7,
      },
    });

    expect(map.get('2')).toMatchObject({ streak: 0, daysSince: 3 });
    expect(map.get('2')!.history).toEqual([
      { date: day(3), ratings: { play: 4 } },
    ]);

    expect(map.get('3')).toEqual({ streak: 0, daysSince: -1, history: [] });
  });

  it('ровно 3 запроса независимо от числа клиентов', async () => {
    const prisma = makePrisma(ratings);
    const svc = new BotClientOverviewService(prisma);
    await svc.getClientOverviews([A, B, C]);
    expect(prisma.countQueries()).toBe(3);
  });

  it('D5: запрос distinct-дат (allDates) уходит со страховочным потолком take: 5000 и orderBy по свежести', async () => {
    const prisma = makePrisma(ratings);
    const svc = new BotClientOverviewService(prisma);
    await svc.getClientOverviews([A, B, C]);

    const calls = prisma.rating.findMany.mock.calls as any[];
    // Различаем два вызова rating.findMany по наличию distinct — только у
    // allDates (запрос №2) он есть, у recentRows (запрос №3) нет.
    const allDatesArgs = calls.find((c) => c[0].distinct)?.[0];
    const recentRowsArgs = calls.find((c) => !c[0].distinct)?.[0];

    expect(allDatesArgs).toMatchObject({
      distinct: ['userId', 'date'],
      orderBy: { date: 'desc' },
      take: 5000,
    });
    // Потолок — только для allDates. recentRows и так ограничен union дат за
    // 14 дней (запрос №3), ему такой предохранитель не нужен.
    expect(recentRowsArgs).toBeDefined();
    expect(recentRowsArgs.take).toBeUndefined();
    expect(recentRowsArgs.orderBy).toBeUndefined();
  });

  it('пустой список клиентов — ноль запросов', async () => {
    const prisma = makePrisma([]);
    const svc = new BotClientOverviewService(prisma);
    const map = await svc.getClientOverviews([]);
    expect(map.size).toBe(0);
    expect(prisma.countQueries()).toBe(0);
  });
});

// Перенесено из bot.analytics.service.spec.ts после выноса метода в
// BotClientOverviewService (#177): лёгкий фейк с overrides + дни-хелпер.
function d(daysAgo: number): string {
  const t = new Date();
  t.setUTCDate(t.getUTCDate() - daysAgo);
  return t.toISOString().slice(0, 10);
}
function makePrismaLite(overrides: Record<string, unknown> = {}) {
  return {
    user: { findMany: jest.fn().mockResolvedValue([]) },
    rating: { findMany: jest.fn().mockResolvedValue([]) },
    ...overrides,
  };
}

describe('getClientOverviews — перенос из analytics-спека (#177)', () => {
  it('empty userIds → empty map, no db calls', async () => {
    const prisma = makePrismaLite();
    const svc = new BotClientOverviewService(prisma as never);
    const out = await svc.getClientOverviews([]);
    expect(out.size).toBe(0);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it('batches streak/daysSince/history for several clients in one pass', async () => {
    const prisma = makePrismaLite({
      user: {
        findMany: jest.fn().mockResolvedValue([
          { id: 1n, notifyTimezone: 'UTC' },
          { id: 2n, notifyTimezone: 'UTC' },
        ]),
      },
      rating: {
        findMany: jest.fn(({ select }: any) => {
          // Первый вызов — distinct-даты (для стрика/давности), второй —
          // полные строки за последние 14 дней (для history).
          if (select && !('needId' in select) && !('value' in select)) {
            return Promise.resolve([
              { userId: 1n, date: d(0) },
              { userId: 1n, date: d(1) },
              { userId: 2n, date: d(5) },
            ]);
          }
          return Promise.resolve([
            { userId: 1n, date: d(0), needId: 'attachment', value: 7 },
            { userId: 1n, date: d(1), needId: 'attachment', value: 6 },
            { userId: 2n, date: d(5), needId: 'autonomy', value: 4 },
          ]);
        }),
      },
    });
    const svc = new BotClientOverviewService(prisma as never);
    const out = await svc.getClientOverviews([1n, 2n]);
    expect(out.get('1')!.streak).toBe(2);
    expect(out.get('1')!.daysSince).toBe(0);
    expect(out.get('1')!.history.map((h) => h.date)).toContain(d(0));
    expect(out.get('2')!.streak).toBe(0); // last fill 5 days ago, not today/yesterday
    expect(out.get('2')!.daysSince).toBe(5);
  });

  it('client with no ratings at all gets daysSince = -1 and empty history', async () => {
    const prisma = makePrismaLite({
      user: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 3n, notifyTimezone: 'UTC' }]),
      },
    });
    const svc = new BotClientOverviewService(prisma as never);
    const out = await svc.getClientOverviews([3n]);
    expect(out.get('3')).toEqual({ streak: 0, daysSince: -1, history: [] });
  });
});

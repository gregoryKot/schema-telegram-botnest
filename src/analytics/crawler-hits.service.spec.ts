// Сброс счётчика заходов роботов в AnalyticsEvent и обратный путь в /stats:
// «сохранил → нашёл» (правило тестов): то, что пишет крон, читает блок отчёта.
import { Logger } from '@nestjs/common';
import { CrawlerHitsService, CRAWLER_EVENT } from './crawler-hits.service';
import { createCrawlerCounter } from './crawler-hits';
import { ANALYTICS_EVENTS } from './analytics.constants';
import { CrawlerMetricsService } from '../bot/crawler-metrics.service';

type Row = {
  userId: bigint | null;
  name: string;
  meta: unknown;
  createdAt: Date;
};

/** Поддельная таблица AnalyticsEvent: createMany кладёт, findMany отбирает. */
function fakePrisma(rows: Row[] = []) {
  return {
    rows,
    analyticsEvent: {
      createMany: jest.fn(
        async ({ data }: { data: Omit<Row, 'createdAt'>[] }) => {
          for (const d of data) rows.push({ ...d, createdAt: new Date() });
          return { count: data.length };
        },
      ),
      findMany: jest.fn(
        async ({
          where,
        }: {
          where: { name: string; userId: null; createdAt: { gte: Date } };
        }) =>
          rows
            .filter(
              (r) =>
                r.name === where.name &&
                r.userId === where.userId &&
                r.createdAt >= where.createdAt.gte,
            )
            .map((r) => ({ meta: r.meta })),
      ),
    },
  };
}

function build(prisma = fakePrisma()) {
  const counter = createCrawlerCounter();
  const svc = new CrawlerHitsService(prisma as never);
  svc.counter = counter;
  return { svc, counter, prisma };
}

describe('CrawlerHitsService.flush', () => {
  it('имя события — в allow-list ANALYTICS_EVENTS', () => {
    expect(ANALYTICS_EVENTS).toContain(CRAWLER_EVENT);
  });

  it('ничего не накоплено — в БД не ходит', async () => {
    const { svc, prisma } = build();
    await svc.flush();
    expect(prisma.analyticsEvent.createMany).not.toHaveBeenCalled();
    expect(prisma.rows).toEqual([]);
  });

  it('строка на ключ, userId = null, счётчик обнулён', async () => {
    const { svc, counter, prisma } = build();
    counter.record('GPTBot', '/', 'schemehappens.ru', 200);
    counter.record('GPTBot', '/', 'schemehappens.ru', 200);
    counter.record('YandexBot', '/articles/x', 'schemehappens.ru', 404);
    await svc.flush();
    expect(prisma.rows).toHaveLength(2);
    expect(
      prisma.rows.every((r) => r.userId === null && r.name === CRAWLER_EVENT),
    ).toBe(true);
    expect(counter.drain()).toEqual([]);
  });

  it('БД не ответила — накопленное возвращается и уходит следующим сбросом', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const { svc, counter, prisma } = build();
    counter.record('ClaudeBot', '/', 'schemehappens.ru', 200);
    prisma.analyticsEvent.createMany.mockRejectedValueOnce(
      new Error('db down'),
    );
    await svc.flush();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('db down'));
    expect(prisma.rows).toHaveLength(0);
    await svc.flush();
    expect(prisma.rows).toHaveLength(1);
    expect(prisma.rows[0].meta).toMatchObject({ bot: 'ClaudeBot', hits: 1 });
    warn.mockRestore();
  });
});

describe('сохранил → нашёл: сброс крона виден в /stats', () => {
  it('блок «Роботы нейросетей» показывает записанные заходы', async () => {
    const prisma = fakePrisma();
    const { svc, counter } = build(prisma);
    counter.record('OAI-SearchBot', '/', 'schemehappens.ru', 200);
    counter.record('OAI-SearchBot', '/articles/a', 'schemehappens.ru', 200);
    await svc.flush();
    const text = await new CrawlerMetricsService(prisma as never).render();
    expect(text).toContain('ChatGPT: поиск — 2 захода: главная 1, статьи 1');
  });

  it('строка с userId (с клиента) и мусорная meta в отчёт не попадают', async () => {
    const prisma = fakePrisma([
      {
        userId: 5n,
        name: CRAWLER_EVENT,
        createdAt: new Date(),
        meta: {
          bot: 'GPTBot',
          page: 'home',
          site: 'main',
          hits: 99,
          ok: 99,
          redirect: 0,
          limited: 0,
          missing: 0,
          error: 0,
        },
      },
      {
        userId: null,
        name: CRAWLER_EVENT,
        createdAt: new Date(),
        meta: { bot: 'EvilBot', hits: 3 },
      },
    ]);
    const m = await new CrawlerMetricsService(prisma as never).getMetrics();
    expect(m.bots).toEqual([]);
  });

  it('строки старше 7 дней в блок не попадают', async () => {
    const meta = {
      bot: 'GPTBot',
      page: 'home',
      site: 'main',
      hits: 1,
      ok: 1,
      redirect: 0,
      limited: 0,
      missing: 0,
      error: 0,
    };
    const old = new Date(Date.now() - 8 * 86_400_000);
    const prisma = fakePrisma([
      { userId: null, name: CRAWLER_EVENT, createdAt: old, meta },
      { userId: null, name: CRAWLER_EVENT, createdAt: new Date(), meta },
    ]);
    const m = await new CrawlerMetricsService(prisma as never).getMetrics();
    expect(m.bots.map((b) => [b.bot, b.hits])).toEqual([['GPTBot', 1]]);
  });
});

import { CRAWLER_BOT_IDS, type CrawlerBotId } from './crawler-bots';

// Форма строки события crawler_visits — одна на запись и на чтение: счётчик
// (crawler-hits.ts) её собирает, ветка sanitizeMeta и отчёт /stats
// (src/bot/crawler-metrics.service.ts) пропускают через sanitizeCrawlerMeta.
// Все поля — из закрытых списков или целые числа: ни адресов, ни
// User-Agent, ни путей запроса.

/** Раздел сайта, куда пришёл робот (crawlerPage в crawler-hits.ts). */
export const CRAWLER_PAGES = [
  'home',
  'articles',
  'tests',
  'service',
  'render',
  'other',
] as const;
export type CrawlerPage = (typeof CRAWLER_PAGES)[number];

export const CRAWLER_SITES = ['main', 'practice'] as const;
export type CrawlerSite = (typeof CRAWLER_SITES)[number];

/** Что получил робот: 2xx и 304 — ок; 3xx — переадресация; 429 — отказ «слишком часто». */
export const CRAWLER_OUTCOMES = [
  'ok',
  'redirect',
  'limited',
  'missing',
  'error',
] as const;
export type CrawlerOutcome = (typeof CRAWLER_OUTCOMES)[number];

/** meta события crawler_visits: один ключ за час одного инстанса. */
export type CrawlerVisitMeta = {
  bot: CrawlerBotId;
  page: CrawlerPage;
  site: CrawlerSite;
  hits: number;
} & Record<CrawlerOutcome, number>;

export const emptyCrawlerMeta = (
  bot: CrawlerBotId,
  page: CrawlerPage,
  site: CrawlerSite,
): CrawlerVisitMeta => ({
  bot,
  page,
  site,
  hits: 0,
  ok: 0,
  redirect: 0,
  limited: 0,
  missing: 0,
  error: 0,
});

/** Только известные поля из закрытых списков; иначе undefined (строку не верим). */
export function sanitizeCrawlerMeta(
  meta: unknown,
): CrawlerVisitMeta | undefined {
  if (!meta || typeof meta !== 'object') return undefined;
  const m = meta as Record<string, unknown>;
  const inSet = (v: unknown, set: readonly string[]) =>
    typeof v === 'string' && set.includes(v);
  const count = (v: unknown) =>
    typeof v === 'number' && Number.isInteger(v) && v >= 0
      ? Math.min(v, 1_000_000)
      : null;
  if (
    !inSet(m.bot, CRAWLER_BOT_IDS) ||
    !inSet(m.page, CRAWLER_PAGES) ||
    !inSet(m.site, CRAWLER_SITES)
  )
    return undefined;
  const out = emptyCrawlerMeta(
    m.bot as CrawlerBotId,
    m.page as CrawlerPage,
    m.site as CrawlerSite,
  );
  for (const k of ['hits', ...CRAWLER_OUTCOMES] as const) {
    const n = count(m[k]);
    if (n === null) return undefined;
    out[k] = n;
  }
  return out.hits > 0 ? out : undefined;
}

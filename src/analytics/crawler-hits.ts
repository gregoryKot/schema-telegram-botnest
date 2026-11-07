import type { NextFunction, Request, Response } from 'express';
import { detectCrawler, type CrawlerBotId } from './crawler-bots';
import {
  CRAWLER_OUTCOMES,
  emptyCrawlerMeta,
  type CrawlerOutcome,
  type CrawlerPage,
  type CrawlerSite,
  type CrawlerVisitMeta,
} from './crawler-visit.meta';

/**
 * Счётчик заходов роботов нейросетей и поисковиков (GEO.md: «кто из краулеров
 * приходит и что получает»). Логов приложения в Actions нет намеренно, а без
 * счётчика вопрос «ChatGPT вообще видит сайт?» не решить.
 *
 * Как устроено — просто и честно:
 *  • middleware стоит в main.ts первым после выборки адресов, до редиректов:
 *    видит и 301 визитки, и статику, и ответы с ошибкой;
 *  • запрос человека стоит один проход регэкспа по первым 512 символам
 *    User-Agent (crawler-bots.ts), больше ничего: ни БД, ни записи;
 *  • запрос робота добавляет `finish`-слушатель и по коду ответа
 *    увеличивает счётчик в памяти процесса — ключ «робот × раздел × сайт»;
 *  • раз в час CrawlerHitsService сбрасывает накопленное в AnalyticsEvent
 *    (событие crawler_visits, строка на ключ, userId = null) и обнуляет.
 *
 * Ключи — из закрытых списков, поэтому память ограничена (≤ 13 × 6 × 2 строк)
 * при любом трафике. Счётчик свой у каждого инстанса — сбрасывает каждый своё,
 * /stats суммирует строки. Рестарт теряет не сброшенный час: хуков остановки
 * в main.ts нет, и ради счётчика заходов их не заводим.
 */

const SERVICE_FILES = new Set(['/robots.txt', '/sitemap.xml', '/llms.txt']);
const under = (path: string, root: string) =>
  path === root || path.startsWith(`${root}/`);

/** Раздел сайта, куда пришёл робот. Без регэкспа: сравнение строк. */
export function crawlerPage(path: string): CrawlerPage {
  if (path === '/') return 'home';
  if (SERVICE_FILES.has(path)) return 'service';
  if (under(path, '/articles')) return 'articles';
  if (under(path, '/tests')) return 'tests';
  // Данные и файлы, без которых страница не нарисуется: API и всё с точкой
  // в последнем сегменте (бандл, картинки, манифест).
  if (under(path, '/api')) return 'render';
  if (path.slice(path.lastIndexOf('/') + 1).includes('.')) return 'render';
  return 'other';
}

/** Хоста может не быть (HTTP/1.0 без Host): тогда — основной сайт. Слушатель
 *  `finish` бросать не должен — исключение там уронило бы процесс. */
export function crawlerSite(hostname: string | undefined): CrawlerSite {
  return hostname?.includes('kotlarewski.') ? 'practice' : 'main';
}

export function crawlerOutcome(status: number): CrawlerOutcome {
  if (status === 304 || (status >= 200 && status < 300)) return 'ok';
  if (status >= 300 && status < 400) return 'redirect';
  if (status === 429) return 'limited';
  if (status >= 400 && status < 500) return 'missing';
  return 'error';
}

export function createCrawlerCounter() {
  let counts = new Map<string, CrawlerVisitMeta>();

  const add = (m: CrawlerVisitMeta) => {
    const key = `${m.bot}|${m.page}|${m.site}`;
    const cur = counts.get(key) ?? emptyCrawlerMeta(m.bot, m.page, m.site);
    cur.hits += m.hits;
    for (const o of CRAWLER_OUTCOMES) cur[o] += m[o];
    counts.set(key, cur);
  };

  function record(
    bot: CrawlerBotId,
    path: string,
    hostname: string | undefined,
    status: number,
  ): void {
    const m = emptyCrawlerMeta(bot, crawlerPage(path), crawlerSite(hostname));
    m.hits = 1;
    m[crawlerOutcome(status)] = 1;
    add(m);
  }

  function middleware(req: Request, res: Response, next: NextFunction): void {
    const bot = detectCrawler(req.headers['user-agent']);
    if (bot) {
      const { path, hostname } = req;
      res.once('finish', () => record(bot, path, hostname, res.statusCode));
    }
    next();
  }

  /** Забрать накопленное и обнулить (сброс в БД). */
  function drain(): CrawlerVisitMeta[] {
    const out = [...counts.values()];
    counts = new Map();
    return out;
  }

  /** Вернуть не записанное (БД не ответила) — уйдёт со следующим сбросом. */
  function absorb(rows: CrawlerVisitMeta[]): void {
    for (const r of rows) add(r);
  }

  return { middleware, record, drain, absorb };
}

const defaultCounter = createCrawlerCounter();

/** Middleware для main.ts: сразу после clientIpSampler, до редиректов. */
export const crawlerHitCounter = defaultCounter.middleware;
export const crawlerHits = {
  drain: defaultCounter.drain,
  absorb: defaultCounter.absorb,
};

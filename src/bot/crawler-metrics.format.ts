import { crawlerLabel, type CrawlerBotId } from '../analytics/crawler-bots';
import {
  CRAWLER_PAGES,
  type CrawlerPage,
  type CrawlerVisitMeta,
} from '../analytics/crawler-visit.meta';
import { plural } from './plural';

// Блок «Роботы нейросетей» для /stats (правило №8; GEO.md — «кто из краулеров
// приходит и что получает»). Строки — событие crawler_visits, раз в час с
// каждого инстанса (src/analytics/crawler-hits.ts). Чистые функции: сводка и
// текст, покрыты тестом, включая пустую БД.

export const CRAWLER_WINDOW_DAYS = 7;

export interface CrawlerBotSummary {
  bot: CrawlerBotId;
  hits: number;
  pages: Record<CrawlerPage, number>;
  /** Из них на визитке kotlarewski.gr. */
  practice: number;
  redirect: number;
  limited: number;
  missing: number;
  error: number;
}

export interface CrawlerMetrics {
  /** По убыванию заходов. */
  bots: CrawlerBotSummary[];
}

const zeroPages = (): Record<CrawlerPage, number> => ({
  home: 0,
  articles: 0,
  tests: 0,
  service: 0,
  render: 0,
  other: 0,
});

export function aggregateCrawlerVisits(
  rows: CrawlerVisitMeta[],
): CrawlerMetrics {
  const by = new Map<CrawlerBotId, CrawlerBotSummary>();
  for (const r of rows) {
    const s = by.get(r.bot) ?? {
      bot: r.bot,
      hits: 0,
      pages: zeroPages(),
      practice: 0,
      redirect: 0,
      limited: 0,
      missing: 0,
      error: 0,
    };
    s.hits += r.hits;
    s.pages[r.page] += r.hits;
    if (r.site === 'practice') s.practice += r.hits;
    s.redirect += r.redirect;
    s.limited += r.limited;
    s.missing += r.missing;
    s.error += r.error;
    by.set(r.bot, s);
  }
  return { bots: [...by.values()].sort((a, b) => b.hits - a.hits) };
}

const PAGE_LABEL: Record<CrawlerPage, string> = {
  home: 'главная',
  articles: 'статьи',
  tests: 'тесты',
  service: 'служебные файлы для роботов',
  render: 'файлы для отрисовки страниц',
  other: 'другие страницы',
};

const times = (n: number) => `${n} ${plural(n, 'заход', 'захода', 'заходов')}`;

function botLine(s: CrawlerBotSummary): string {
  const pages = CRAWLER_PAGES.filter((p) => s.pages[p] > 0)
    .map((p) => `${PAGE_LABEL[p]} ${s.pages[p]}`)
    .join(', ');
  const site = s.practice > 0 ? `; на визитке ${s.practice}` : '';
  const lines = [
    `• ${crawlerLabel(s.bot)} — ${times(s.hits)}: ${pages}${site}`,
  ];
  const notes = [
    s.redirect > 0 ? `переадресовано ${s.redirect}` : '',
    s.missing > 0 ? `страница не найдена ${s.missing}` : '',
    s.limited > 0 ? `отказ «слишком часто» ${s.limited}` : '',
    s.error > 0 ? `ошибка сервера ${s.error}` : '',
  ].filter(Boolean);
  if (notes.length) lines.push(`   ${notes.join(', ')}`);
  return lines.join('\n');
}

/** Текстовый блок для /stats. Чистая функция. */
export function formatCrawlerMetrics(m: CrawlerMetrics): string {
  const lines = ['🤖 <b>Роботы нейросетей</b>'];
  const days = `${CRAWLER_WINDOW_DAYS} ${plural(CRAWLER_WINDOW_DAYS, 'день', 'дня', 'дней')}`;
  if (m.bots.length === 0) {
    lines.push(
      `За ${days} ни один робот нейросети или поисковика не заходил ` +
        '(счёт записывается раз в час).',
    );
    return lines.join('\n');
  }
  const total = m.bots.reduce((a, b) => a + b.hits, 0);
  const n = m.bots.length;
  lines.push(
    `За ${days}: ${times(total)} от ${n} ${plural(n, 'робота', 'роботов', 'роботов')}.`,
  );
  for (const s of m.bots) lines.push(botLine(s));
  if (m.bots.some((s) => s.limited > 0 || s.error > 0)) {
    lines.push(
      'Отказы и ошибки — сайт не отдал роботу страницу, стоит проверить.',
    );
  }
  lines.push('Робот узнаётся по подписи в запросе, её можно подделать.');
  return lines.join('\n');
}

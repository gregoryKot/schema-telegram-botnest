// Блок «Роботы нейросетей» в /stats: пустая БД — честная фраза без нулей и
// NaN; непустая — по роботу строка, разделы словами, отказы отдельно.
import type { CrawlerVisitMeta } from '../analytics/crawler-visit.meta';
import {
  aggregateCrawlerVisits,
  formatCrawlerMetrics,
} from './crawler-metrics.format';

const row = (over: Partial<CrawlerVisitMeta>): CrawlerVisitMeta => ({
  bot: 'GPTBot',
  page: 'home',
  site: 'main',
  hits: 1,
  ok: 1,
  redirect: 0,
  limited: 0,
  missing: 0,
  error: 0,
  ...over,
});

describe('formatCrawlerMetrics', () => {
  it('пустая БД: одна фраза, без нулей, NaN и undefined', () => {
    const text = formatCrawlerMetrics(aggregateCrawlerVisits([]));
    expect(text).toBe(
      '🤖 <b>Роботы нейросетей</b>\n' +
        'За 7 дней ни один робот нейросети или поисковика не заходил (счёт записывается раз в час).',
    );
    expect(text).not.toMatch(/NaN|undefined|null| 0 /);
  });

  it('по роботу строка, по убыванию заходов; разделы словами, визитка отдельно', () => {
    const text = formatCrawlerMetrics(
      aggregateCrawlerVisits([
        row({ bot: 'OAI-SearchBot', hits: 1, ok: 1 }),
        row({ bot: 'YandexBot', page: 'articles', hits: 3, ok: 3 }),
        row({ bot: 'YandexBot', page: 'render', hits: 2, ok: 2 }),
        row({
          bot: 'YandexBot',
          page: 'other',
          site: 'practice',
          hits: 1,
          ok: 0,
          redirect: 1,
        }),
      ]),
    );
    const lines = text.split('\n');
    expect(lines[1]).toBe('За 7 дней: 7 заходов от 2 роботов.');
    expect(lines[2]).toBe(
      '• Яндекс: поиск и Алиса — 6 заходов: статьи 3, файлы для отрисовки страниц 2, другие страницы 1; на визитке 1',
    );
    expect(lines[3]).toBe('   переадресовано 1');
    expect(lines[4]).toBe('• ChatGPT: поиск — 1 заход: главная 1');
    expect(text).not.toContain('стоит проверить');
    expect(text).toContain('её можно подделать');
  });

  it('отказы «слишком часто» и ошибки сервера — отдельной строкой и с подсказкой', () => {
    const text = formatCrawlerMetrics(
      aggregateCrawlerVisits([
        row({ bot: 'ClaudeBot', hits: 4, ok: 1, limited: 2, error: 1 }),
        row({ bot: 'ClaudeBot', page: 'articles', hits: 1, ok: 0, missing: 1 }),
      ]),
    );
    expect(text).toContain('За 7 дней: 5 заходов от 1 робота.');
    expect(text).toContain(
      '   страница не найдена 1, отказ «слишком часто» 2, ошибка сервера 1',
    );
    expect(text).toContain(
      'Отказы и ошибки — сайт не отдал роботу страницу, стоит проверить.',
    );
  });

  it('склонение: 2 захода, 21 заход', () => {
    const two = formatCrawlerMetrics(
      aggregateCrawlerVisits([row({ hits: 2, ok: 2 })]),
    );
    expect(two).toContain('— 2 захода:');
    const many = formatCrawlerMetrics(
      aggregateCrawlerVisits([row({ hits: 21, ok: 21 })]),
    );
    expect(many).toContain('За 7 дней: 21 заход от 1 робота.');
  });
});

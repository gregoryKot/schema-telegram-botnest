// Счётчик заходов роботов (crawler-hits.ts): разделы, исход ответа, сайт —
// и агрегация в памяти на настоящем express: робот считается по коду ответа,
// человек не оставляет следа, drain обнуляет, absorb возвращает не записанное.
import express from 'express';
import request from 'supertest';
import {
  createCrawlerCounter,
  crawlerOutcome,
  crawlerPage,
  crawlerSite,
} from './crawler-hits';
import { sanitizeCrawlerMeta } from './crawler-visit.meta';
import { sanitizeMeta } from '../api/analytics-meta.sanitize';

const GPT = 'Mozilla/5.0 (compatible; GPTBot/1.1; +https://openai.com/gptbot)';
const YANDEX =
  'Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)';
const CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

describe('классификация запроса', () => {
  it.each([
    ['/', 'home'],
    ['/articles', 'articles'],
    ['/articles/skhemy-yanga-spisok', 'articles'],
    ['/tests/perfectionism', 'tests'],
    ['/robots.txt', 'service'],
    ['/sitemap.xml', 'service'],
    ['/llms.txt', 'service'],
    ['/api/articles', 'render'],
    ['/assets/index-CTgJf44i.js', 'render'],
    ['/today', 'other'],
    ['/articlesx', 'other'],
  ])('%s → %s', (path, page) => {
    expect(crawlerPage(path)).toBe(page);
  });

  it('сайт: визитка по имени хоста, остальное — основной', () => {
    expect(crawlerSite('kotlarewski.gr')).toBe('practice');
    expect(crawlerSite('www.kotlarewski.ru')).toBe('practice');
    expect(crawlerSite('schemehappens.ru')).toBe('main');
    expect(crawlerSite(undefined)).toBe('main');
  });

  it.each([
    [200, 'ok'],
    [304, 'ok'],
    [301, 'redirect'],
    [302, 'redirect'],
    [429, 'limited'],
    [404, 'missing'],
    [403, 'missing'],
    [500, 'error'],
    [503, 'error'],
  ])('код %i → %s', (status, outcome) => {
    expect(crawlerOutcome(status)).toBe(outcome);
  });
});

function buildApp() {
  const counter = createCrawlerCounter();
  const app = express();
  app.use(counter.middleware);
  app.get('/', (_req, res) => {
    res.send('home');
  });
  app.get('/old', (_req, res) => res.redirect(301, '/'));
  return { app, counter };
}

const tick = () => new Promise((r) => setImmediate(r));

describe('createCrawlerCounter: агрегация в памяти', () => {
  it('робот считается по коду ответа; человек не оставляет следа', async () => {
    const { app, counter } = buildApp();
    await request(app)
      .get('/')
      .set('Host', 'schemehappens.ru')
      .set('User-Agent', GPT);
    await request(app)
      .get('/')
      .set('Host', 'schemehappens.ru')
      .set('User-Agent', GPT);
    await request(app)
      .get('/nope')
      .set('Host', 'schemehappens.ru')
      .set('User-Agent', GPT);
    await request(app)
      .get('/')
      .set('Host', 'schemehappens.ru')
      .set('User-Agent', CHROME);
    await request(app)
      .get('/old')
      .set('Host', 'kotlarewski.gr')
      .set('User-Agent', YANDEX);
    await tick();
    const rows = counter.drain();
    expect(rows).toEqual(
      expect.arrayContaining([
        {
          bot: 'GPTBot',
          page: 'home',
          site: 'main',
          hits: 2,
          ok: 2,
          redirect: 0,
          limited: 0,
          missing: 0,
          error: 0,
        },
        {
          bot: 'GPTBot',
          page: 'other',
          site: 'main',
          hits: 1,
          ok: 0,
          redirect: 0,
          limited: 0,
          missing: 1,
          error: 0,
        },
        {
          bot: 'YandexBot',
          page: 'other',
          site: 'practice',
          hits: 1,
          ok: 0,
          redirect: 1,
          limited: 0,
          missing: 0,
          error: 0,
        },
      ]),
    );
    expect(rows).toHaveLength(3);
  });

  it('drain обнуляет; absorb возвращает строки и складывает с новыми', () => {
    const { counter } = buildApp();
    counter.record('ClaudeBot', '/', 'schemehappens.ru', 200);
    const first = counter.drain();
    expect(counter.drain()).toEqual([]);
    counter.absorb(first);
    counter.record('ClaudeBot', '/', 'schemehappens.ru', 503);
    expect(counter.drain()).toEqual([
      {
        bot: 'ClaudeBot',
        page: 'home',
        site: 'main',
        hits: 2,
        ok: 1,
        redirect: 0,
        limited: 0,
        missing: 0,
        error: 1,
      },
    ]);
  });
});

describe('sanitizeCrawlerMeta: только закрытые списки и целые числа', () => {
  const valid = {
    bot: 'GPTBot',
    page: 'home',
    site: 'main',
    hits: 3,
    ok: 3,
    redirect: 0,
    limited: 0,
    missing: 0,
    error: 0,
  };

  it('валидная строка проходит; лишние поля срезаны', () => {
    expect(
      sanitizeCrawlerMeta({ ...valid, ua: 'Mozilla/5.0 …', ip: '1.2.3.4' }),
    ).toEqual(valid);
  });

  it('незнакомый робот, раздел или сайт — строка отброшена', () => {
    expect(sanitizeCrawlerMeta({ ...valid, bot: 'EvilBot' })).toBeUndefined();
    expect(sanitizeCrawlerMeta({ ...valid, page: '/admin' })).toBeUndefined();
    expect(sanitizeCrawlerMeta({ ...valid, site: 'evil.com' })).toBeUndefined();
  });

  it('не целое, минус, строка или ноль заходов — отброшено; потолок 1 000 000', () => {
    expect(sanitizeCrawlerMeta({ ...valid, hits: 1.5 })).toBeUndefined();
    expect(sanitizeCrawlerMeta({ ...valid, ok: -1 })).toBeUndefined();
    expect(sanitizeCrawlerMeta({ ...valid, error: '2' })).toBeUndefined();
    expect(sanitizeCrawlerMeta({ ...valid, hits: 0, ok: 0 })).toBeUndefined();
    expect(sanitizeCrawlerMeta({ ...valid, hits: 5e9 })?.hits).toBe(1_000_000);
    expect(sanitizeCrawlerMeta(null)).toBeUndefined();
    expect(sanitizeCrawlerMeta('GPTBot')).toBeUndefined();
  });

  it('ветка sanitizeMeta для POST /api/event — тот же фильтр', () => {
    expect(sanitizeMeta('crawler_visits', { ...valid, note: 'текст' })).toEqual(
      valid,
    );
    expect(sanitizeMeta('crawler_visits', { bot: 'GPTBot' })).toBeUndefined();
  });
});

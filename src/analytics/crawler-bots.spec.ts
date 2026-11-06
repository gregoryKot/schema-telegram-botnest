// Распознавание роботов по User-Agent (crawler-bots.ts): образцы — настоящие
// заголовки из документации площадок, контрольные образцы — обычные браузеры
// и чужие роботы, которых мы не считаем. Плюс сверка с robots.txt (правило
// №4): каждая группа там — либо робот из реестра, либо токен без User-Agent.
import { readFileSync } from 'fs';
import { join } from 'path';
import { CRAWLER_BOTS, crawlerLabel, detectCrawler } from './crawler-bots';

const BOT_UA: Array<[string, string]> = [
  [
    'OAI-SearchBot',
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot',
  ],
  [
    'ChatGPT-User',
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot',
  ],
  [
    'GPTBot',
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.1; +https://openai.com/gptbot',
  ],
  [
    'Claude-SearchBot',
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-SearchBot/1.0; +Claude-SearchBot@anthropic.com)',
  ],
  [
    'Claude-User',
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-User/1.0; +Claude-User@anthropic.com)',
  ],
  [
    'ClaudeBot',
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)',
  ],
  [
    'PerplexityBot',
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)',
  ],
  [
    'Perplexity-User',
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Perplexity-User/1.0; +https://perplexity.ai/perplexity-user)',
  ],
  [
    'Googlebot',
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Googlebot/2.1; +http://www.google.com/bot.html) Chrome/120.0.6099.71 Safari/537.36',
  ],
  ['Googlebot', 'Googlebot-Image/1.0'],
  [
    'bingbot',
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm) Chrome/116.0.1938.76 Safari/537.36',
  ],
  [
    'Applebot',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.1.1 Safari/605.1.15 (Applebot/0.1; +http://www.apple.com/go/applebot)',
  ],
  [
    'YandexBot',
    'Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)',
  ],
  [
    'YandexAdditional',
    'Mozilla/5.0 (compatible; YandexAdditional/3.0; +http://yandex.com/bots)',
  ],
  [
    'YandexAdditional',
    'Mozilla/5.0 (compatible; YandexAdditionalBot/3.0; +http://yandex.com/bots)',
  ],
];

// Люди и роботы вне реестра: ни один не должен посчитаться.
const NOT_BOT_UA = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 YaBrowser/24.10.0.0 Safari/537.36',
  'Mozilla/5.0 (Android 14; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0',
  'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0 Mobile Safari/537.36 Telegram-Android/11.2.2',
  'Mozilla/5.0 (compatible; YandexImages/3.0; +http://yandex.com/bots)',
  'AdsBot-Google (+http://www.google.com/adsbot.html)',
  'curl/8.5.0',
  'node',
];

describe('detectCrawler: роботы из реестра', () => {
  it.each(BOT_UA)('%s узнаётся в настоящем заголовке', (id, ua) => {
    expect(detectCrawler(ua)).toBe(id);
  });

  it('регистр не важен: подпись площадки иногда пишут иначе', () => {
    expect(detectCrawler('mozilla/5.0 (compatible; YANDEXBOT/3.0)')).toBe(
      'YandexBot',
    );
  });

  it('у каждого робота реестра есть образец выше', () => {
    const covered = new Set(BOT_UA.map(([id]) => id));
    expect(CRAWLER_BOTS.filter((b) => !covered.has(b.id))).toEqual([]);
  });
});

describe('detectCrawler: контрольные образцы — не считаются', () => {
  it.each(NOT_BOT_UA)('%s', (ua) => {
    expect(detectCrawler(ua)).toBeNull();
  });

  it('пустой и отсутствующий заголовок', () => {
    expect(detectCrawler(undefined)).toBeNull();
    expect(detectCrawler('')).toBeNull();
  });

  it('подпись дальше 512 символов не ищется; в начале длинного — находится', () => {
    expect(detectCrawler(`${'x'.repeat(600)} GPTBot/1.1`)).toBeNull();
    expect(detectCrawler(`GPTBot/1.1 ${'x'.repeat(10_000)}`)).toBe('GPTBot');
  });
});

describe('реестр', () => {
  it('ни одна подпись не содержит другую: порядок альтернатив не влияет', () => {
    const ids = CRAWLER_BOTS.map((b) => b.id.toLowerCase());
    for (const a of ids) {
      for (const b of ids) if (a !== b) expect(a.includes(b)).toBe(false);
    }
  });

  it('у каждого робота понятная метка', () => {
    for (const b of CRAWLER_BOTS) expect(crawlerLabel(b.id)).toContain(':');
  });

  it('группы robots.txt: робот из реестра или токен без своего User-Agent', () => {
    const robots = readFileSync(
      join(__dirname, '..', '..', 'webapp', 'public', 'robots.txt'),
      'utf8',
    );
    const groups = [...robots.matchAll(/^User-agent:\s*(\S+)/gim)].map(
      (m) => m[1],
    );
    // Токены robots.txt, которыми площадка управляет обучением, но под
    // которыми не ходит: Google ходит Googlebot, Apple — Applebot.
    const TOKEN_ONLY = new Set(['*', 'Google-Extended', 'Applebot-Extended']);
    const known = new Set(CRAWLER_BOTS.map((b) => b.id));
    expect(groups.length).toBeGreaterThan(5);
    expect(groups.filter((g) => !TOKEN_ONLY.has(g) && !known.has(g))).toEqual(
      [],
    );
  });
});

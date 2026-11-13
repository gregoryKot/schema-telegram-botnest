// Главная kotlarewski.gr глазами Telegram/Директа/поисковика: что реально
// уходит в <head> после practicePageHtml. До 2026-10 обложка шла с jsdelivr
// и несла «схема-терапевт», цену и schemehappens.ru, а JSON-LD (@id, url,
// image) указывал на продуктовый домен — визитка представлялась чужим адресом.
// До 2026-11 наоборот: карточка визитки (фото автора) стояла в самом
// index.html, и ссылка на продукт schemehappens.ru выглядела как визитка.
import { readFileSync } from 'fs';
import { join } from 'path';
import { REVALIDATE } from './infra/static-cache';
import {
  PRACTICE_PREVIEW_PAGES,
  practiceIndexMiddleware,
  practicePageHtml,
} from './practice-index-html';
import { PRACTICE_PREVIEW, practicePreviewHtml } from './practice-preview';

const WEBAPP = join(__dirname, '..', 'webapp');
const source = readFileSync(join(WEBAPP, 'index.html'), 'utf8');
const html = practicePageHtml(source, 'kotlarewski.gr', '/');

const metaIn =
  (page: string) =>
  (attr: 'property' | 'name', key: string): string | undefined =>
    new RegExp(`<meta ${attr}="${key}"\\s+content="([^"]*)"`).exec(page)?.[1];
const meta = metaIn(html);
const productMeta = metaIn(source);

// Размеры JPEG из маркера SOF (FFC0..FFC3) — без зависимостей.
function jpegSize(buf: Buffer): { width: number; height: number } {
  let i = 2;
  while (i < buf.length) {
    const marker = buf[i + 1];
    const len = buf.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xc3) {
      return {
        height: buf.readUInt16BE(i + 5),
        width: buf.readUInt16BE(i + 7),
      };
    }
    i += 2 + len;
  }
  throw new Error('SOF не найден');
}

interface LdNode {
  '@id': string;
  url?: string;
  image?: string;
  sameAs?: string[];
  provider?: { '@id': string };
  availableChannel?: { serviceUrl: string };
}

describe('главная визитки kotlarewski.gr', () => {
  it('canonical и og:url — на визитку', () => {
    expect(html).toContain(
      '<link rel="canonical" href="https://kotlarewski.gr/" />',
    );
    expect(meta('property', 'og:url')).toBe('https://kotlarewski.gr/');
  });

  it('og:image и twitter:image — с собственного домена, не с CDN', () => {
    expect(meta('property', 'og:image')).toBe(
      'https://kotlarewski.gr/og-cover-v4.jpg',
    );
    expect(meta('name', 'twitter:image')).toBe(
      'https://kotlarewski.gr/og-cover-v4.jpg',
    );
    expect(html).not.toContain('jsdelivr');
  });

  it('файл обложки лежит в public и его размер совпадает с og:image:width/height', () => {
    const size = jpegSize(
      readFileSync(join(WEBAPP, 'public', 'og-cover-v4.jpg')),
    );
    expect(size).toEqual({ width: 1200, height: 630 });
    expect(meta('property', 'og:image:width')).toBe(String(size.width));
    expect(meta('property', 'og:image:height')).toBe(String(size.height));
    expect(meta('property', 'og:image:alt')).toBeTruthy();
  });

  it('JSON-LD: @id, url, serviceUrl и image — на kotlarewski.gr', () => {
    const ld = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(
      html,
    );
    const graph = (JSON.parse(ld![1]) as { '@graph': LdNode[] })['@graph'];
    const [person, service, faq] = graph;
    expect(person['@id']).toBe('https://kotlarewski.gr/#person');
    expect(person.url).toBe('https://kotlarewski.gr');
    expect(person.image).toBe('https://kotlarewski.gr/gregory.jpg');
    expect(person.sameAs).toContain('https://t.me/SchemeHappens');
    expect(service['@id']).toBe('https://kotlarewski.gr/#service');
    expect(service.url).toBe('https://kotlarewski.gr');
    expect(service.provider?.['@id']).toBe('https://kotlarewski.gr/#person');
    expect(service.availableChannel?.serviceUrl).toBe('https://kotlarewski.gr');
    expect(faq['@id']).toBe('https://kotlarewski.gr/#faq');
  });

  // FAQPage в разметке дословно равен видимому FAQ (FAQ_ITEMS, #900):
  // вопрос «Что такое «Всё по схеме»?» жил только в JSON-LD — Google требует,
  // чтобы разметка FAQ совпадала с текстом на странице.
  it('schemehappens — только канал в sameAs', () => {
    const hits = html.match(/\S*schemehappens\S*/gi) ?? [];
    expect(hits).toEqual(['"https://t.me/SchemeHappens"']);
  });

  it('нет самоназвания «психолог»/«терапевт» (правило №12)', () => {
    // Направление к ДРУГОМУ врачу из ответа FAQ законно (правило №12:
    // слово про других — можно); вырезаем ровно эту фразу, остальное — запрет.
    const REFERRAL = 'психотерапевту с медицинским дипломом';
    expect(html).toContain(REFERRAL);
    expect(html.split(REFERRAL).join('')).not.toMatch(/терапевт/i);
    expect(html).not.toMatch(/психолог(?!ическ)/i);
    // Контроль: законная формула услуги по-прежнему на месте.
    expect(html).toMatch(/Психологическое консультирование/);
  });
});

// Карточка ссылки продукта — то, что index.html несёт по умолчанию на любом
// пути schemehappens.ru (краулер превью JS не исполняет).
describe('карточка ссылки: продукт в файле, визитка — подменой', () => {
  const CARD: readonly [
    'property' | 'name',
    string,
    keyof typeof PRACTICE_PREVIEW,
  ][] = [
    ['property', 'og:site_name', 'siteName'],
    ['property', 'og:title', 'title'],
    ['property', 'og:description', 'description'],
    ['property', 'og:image', 'image'],
    ['property', 'og:image:alt', 'imageAlt'],
    ['name', 'twitter:title', 'title'],
    ['name', 'twitter:description', 'description'],
    ['name', 'twitter:image', 'image'],
  ];

  it('в файле — карточка продукта с обложкой со своего домена', () => {
    expect(productMeta('property', 'og:site_name')).toBe('Всё по схеме');
    expect(productMeta('property', 'og:image')).toBe(
      'https://schemehappens.ru/og-app-v1.jpg',
    );
    expect(productMeta('name', 'twitter:image')).toBe(
      'https://schemehappens.ru/og-app-v1.jpg',
    );
    for (const [attr, key] of CARD) {
      expect(productMeta(attr, key)).not.toMatch(/kotlarewski|Котляревск/i);
    }
  });

  it('обложка продукта лежит в public и того же размера, что в og:image:width/height', () => {
    const size = jpegSize(
      readFileSync(join(WEBAPP, 'public', 'og-app-v1.jpg')),
    );
    expect(size).toEqual({
      width: Number(productMeta('property', 'og:image:width')),
      height: Number(productMeta('property', 'og:image:height')),
    });
  });

  it('заголовок вкладки: в файле — продукт без имени автора, у визитки — свой', () => {
    const titleOf = (page: string) => /<title>([^<]*)<\/title>/.exec(page)?.[1];
    expect(titleOf(source)).toBe('Всё по схеме — инструмент схема-терапии');
    expect(titleOf(source)).not.toMatch(/Котляревск/i);
    expect(titleOf(practicePreviewHtml(source))).toBe(PRACTICE_PREVIEW.title);
  });

  it('визитка подменяет каждый тег карточки (тег из файла не пропал)', () => {
    const swapped = metaIn(practicePreviewHtml(source));
    for (const [attr, key, field] of CARD) {
      // Контроль: в файле стоит другое значение — иначе подмена не доказана.
      expect(productMeta(attr, key)).not.toBe(PRACTICE_PREVIEW[field]);
      expect(swapped(attr, key)).toBe(PRACTICE_PREVIEW[field]);
    }
  });
});

// Решение владельца 2026-10-24: /reviews визитки в поиске. Сырой HTML страницы
// (его читают Telegram и поисковик без JS) обязан нести свой canonical, иначе
// /reviews объявляет себя копией главной продукта и в выдачу не попадает.
describe('practiceIndexMiddleware: страницы визитки', () => {
  const run = (
    hostname: string,
    path: string,
    page: string | null = source,
  ) => {
    const sent: { body?: string } = {};
    const headers: Record<string, string> = {};
    let nextCalled = false;
    const res = {
      setHeader: (name: string, value: string) => {
        headers[name] = value;
      },
      send: (body: string) => {
        sent.body = body;
      },
    } as never;
    practiceIndexMiddleware(page, new Set(['kotlarewski.gr']))(
      { hostname, path } as never,
      res,
      () => {
        nextCalled = true;
      },
    );
    return {
      canonical: /rel="canonical" href="([^"]+)"/.exec(sent.body ?? '')?.[1],
      image: metaIn(sent.body ?? '')('property', 'og:image'),
      headers,
      nextCalled,
    };
  };

  it('/reviews и /reviews/ — canonical на саму страницу', () => {
    expect(run('kotlarewski.gr', '/reviews').canonical).toBe(
      'https://kotlarewski.gr/reviews',
    );
    expect(run('kotlarewski.gr', '/reviews/').canonical).toBe(
      'https://kotlarewski.gr/reviews',
    );
  });

  it('главная — canonical на главную визитки', () => {
    expect(run('kotlarewski.gr', '/').canonical).toBe(
      'https://kotlarewski.gr/',
    );
  });

  it('главная — карточка визитки и ревалидация, как у index.html из ServeStatic', () => {
    const page = run('kotlarewski.gr', '/');
    expect(page.image).toBe(PRACTICE_PREVIEW.image);
    expect(page.headers['Cache-Control']).toBe(REVALIDATE);
  });

  // Ссылку на /book отправляют клиентам в мессенджер: карточка — визитки, а
  // canonical страницы вне поиска остаётся как в файле.
  it('/book — карточка визитки, canonical не трогаем', () => {
    const page = run('kotlarewski.gr', '/book');
    expect(page.nextCalled).toBe(false);
    expect(page.image).toBe(PRACTICE_PREVIEW.image);
    expect(page.canonical).toBe('https://schemehappens.ru/');
  });

  it('каждая страница визитки — с карточкой визитки', () => {
    expect(PRACTICE_PREVIEW_PAGES).toEqual(
      expect.arrayContaining(['/', '/reviews', '/book', '/donate', '/privacy']),
    );
    for (const path of PRACTICE_PREVIEW_PAGES) {
      expect([path, run('kotlarewski.gr', path).image]).toEqual([
        path,
        PRACTICE_PREVIEW.image,
      ]);
    }
  });

  it('продуктовый хост, /articles (у ArticleSeoMiddleware) и нет сборки — дальше', () => {
    expect(run('schemehappens.ru', '/reviews').nextCalled).toBe(true);
    expect(run('schemehappens.ru', '/').nextCalled).toBe(true);
    expect(run('kotlarewski.gr', '/articles').nextCalled).toBe(true);
    expect(run('kotlarewski.gr', '/reviews', null).nextCalled).toBe(true);
  });
});

import { ArticleSeoMiddleware } from './article-seo.middleware';
import type { ArticlesService } from './articles.service';

// existsSync/readFileSync экспортируются из 'fs' как non-configurable
// свойства в текущем Node — jest.spyOn(fs, ...) падает "Cannot redefine
// property". jest.mock() подменяет весь модуль на уровне резолвера, это
// работает независимо от дескрипторов свойств рантайма.
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
}));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs') as {
  existsSync: jest.Mock;
  readFileSync: jest.Mock;
};

// Minimal index.html mirroring the real one's SEO-relevant tags.
const BASE_HTML = `<!doctype html>
<html lang="ru">
  <head>
    <title>Григорий Котляревский – схема-терапия онлайн | schemehappens.ru</title>
    <meta name="description" content="Онлайн-консультации в подходе схема-терапии." />
    <link rel="canonical" href="https://schemehappens.ru/" />
    <meta property="og:url"         content="https://schemehappens.ru/" />
    <meta property="og:title"       content="Григорий Котляревский" />
    <meta property="og:description" content="Онлайн-консультации." />
    <meta property="og:type"        content="website" />
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;

function makeMiddleware(article: any): ArticleSeoMiddleware {
  const service = {
    findBySlug: jest.fn(async (slug: string) => {
      if (article && article.slug === slug) return article;
      throw new Error('not found');
    }),
  } as unknown as ArticlesService;
  const mw = new ArticleSeoMiddleware(service);
  // Inject base HTML so the middleware doesn't read from disk.
  (mw as any).cachedHtml = BASE_HTML;
  return mw;
}

function mockReqRes(path: string, hostname = 'schemehappens.ru') {
  const req = { path, hostname } as any;
  let sent: string | null = null;
  const res = {
    setHeader: jest.fn(),
    send: jest.fn((body: string) => {
      sent = body;
    }),
  } as any;
  return { req, res, getSent: () => sent };
}

const ARTICLE = {
  slug: 'skhemy-yanga-spisok',
  title: '18 схем Янга: полный список',
  description: 'Полный список 18 ранних дезадаптивных схем по Джеффри Янгу.',
  content: '<h2>Домен I</h2><p>Первый текст.</p><p>Второй текст.</p>',
  date: new Date('2025-05-10T00:00:00.000Z'),
  readMin: 10,
  heroImage: null,
};

describe('ArticleSeoMiddleware', () => {
  it('injects the article title, description and canonical for a known slug', async () => {
    const mw = makeMiddleware(ARTICLE);
    const { req, res, getSent } = mockReqRes('/articles/skhemy-yanga-spisok');
    const next = jest.fn();

    await mw.use(req, res, next);

    expect(next).not.toHaveBeenCalled();
    const html = getSent()!;
    expect(html).toContain(
      '<title>18 схем Янга: полный список | schemehappens.ru</title>',
    );
    expect(html).toContain(
      'content="Полный список 18 ранних дезадаптивных схем по Джеффри Янгу."',
    );
    expect(html).toContain(
      '<link rel="canonical" href="https://schemehappens.ru/articles/skhemy-yanga-spisok" />',
    );
    expect(html).toContain('property="og:type" content="article"');
  });

  it('injects the article body text into #root so crawlers read it', async () => {
    const mw = makeMiddleware(ARTICLE);
    const { req, res, getSent } = mockReqRes('/articles/skhemy-yanga-spisok');
    await mw.use(req, res, () => {});
    const html = getSent()!;
    expect(html).toContain('<h1>18 схем Янга: полный список</h1>');
    expect(html).toContain('Первый текст.');
    expect(html).toContain('application/ld+json');
    expect(html).toContain('"@type":"Article"');
  });

  it('falls through to the SPA for an unknown slug', async () => {
    const mw = makeMiddleware(ARTICLE);
    const { req, res } = mockReqRes('/articles/does-not-exist');
    const next = jest.fn();
    await mw.use(req, res, next);
    // next() зовётся без аргументов (не next(err)) — это «пропусти дальше», а не ошибка.
    expect(next).toHaveBeenCalledWith();
    expect(res.send).not.toHaveBeenCalled();
    // SEO-заголовок не проставлен — раздача уходит ServeStatic как есть.
    expect(res.setHeader).not.toHaveBeenCalled();
  });

  it('falls through for the /articles list route (not a single article)', async () => {
    const mw = makeMiddleware(ARTICLE);
    const { req, res } = mockReqRes('/articles');
    const next = jest.fn();
    await mw.use(req, res, next);
    expect(next).toHaveBeenCalledWith();
    // Список статей — не одиночная статья: инжекция не запускается вовсе.
    expect(res.send).not.toHaveBeenCalled();
  });

  it('rewrites canonical host for alias domains', async () => {
    const mw = makeMiddleware(ARTICLE);
    const { req, res, getSent } = mockReqRes(
      '/articles/skhemy-yanga-spisok',
      'kotlarewski.ru',
    );
    await mw.use(req, res, () => {});
    const html = getSent()!;
    expect(html).toContain(
      'href="https://kotlarewski.ru/articles/skhemy-yanga-spisok"',
    );
    expect(html).not.toContain('https://schemehappens.ru');
  });

  it('escapes HTML-significant characters in the title', async () => {
    const mw = makeMiddleware({ ...ARTICLE, title: 'КПТ & «схемы» <тест>' });
    const { req, res, getSent } = mockReqRes('/articles/skhemy-yanga-spisok');
    await mw.use(req, res, () => {});
    const html = getSent()!;
    expect(html).toContain(
      '<title>КПТ &amp; «схемы» &lt;тест&gt; | schemehappens.ru</title>',
    );
  });

  it('strips <script> from article content before injecting', async () => {
    const mw = makeMiddleware({
      ...ARTICLE,
      content: '<p>ok</p><script>alert(1)</script>',
    });
    const { req, res, getSent } = mockReqRes('/articles/skhemy-yanga-spisok');
    await mw.use(req, res, () => {});
    const html = getSent()!;
    expect(html).toContain('<p>ok</p>');
    expect(html).not.toContain('alert(1)');
  });

  it('includes og:image / JSON-LD image when the article has a heroImage', async () => {
    const mw = makeMiddleware({
      ...ARTICLE,
      heroImage: 'https://schemehappens.ru/hero.jpg',
    });
    const { req, res, getSent } = mockReqRes('/articles/skhemy-yanga-spisok');
    await mw.use(req, res, () => {});
    const html = getSent()!;
    expect(html).toContain('"image":"https://schemehappens.ru/hero.jpg"');
  });
});

// html() читает dist/index.html с диска и кэширует результат на инстансе —
// остальные тесты выше обходят это, подставляя cachedHtml напрямую. Здесь
// мокаем fs, чтобы не зависеть от того, собран ли webapp/dist локально.
describe('ArticleSeoMiddleware — чтение index.html с диска (html())', () => {
  afterEach(() => {
    fs.existsSync.mockReset();
    fs.readFileSync.mockReset();
  });

  it('index.html не найден на диске → SPA как есть (next(), без send)', async () => {
    fs.existsSync.mockReturnValue(false);
    const service = {
      findBySlug: jest.fn(),
    } as unknown as ArticlesService;
    const mw = new ArticleSeoMiddleware(service);
    const { req, res } = mockReqRes('/articles/skhemy-yanga-spisok');
    const next = jest.fn();

    await mw.use(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(res.send.mock.calls).toEqual([]);
    expect(fs.readFileSync.mock.calls).toEqual([]);
    // articles.service не должен даже дёргаться — early return до похода в БД.
    expect(service.findBySlug.mock.calls).toEqual([]);
  });

  it('index.html найден на диске → читается, кэшируется, статья инжектится', async () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(BASE_HTML);
    const service = {
      findBySlug: jest.fn().mockResolvedValue(ARTICLE),
    } as unknown as ArticlesService;
    const mw = new ArticleSeoMiddleware(service);

    const first = mockReqRes('/articles/skhemy-yanga-spisok');
    await mw.use(first.req, first.res, () => {});
    expect(first.getSent()).toContain('18 схем Янга');
    expect(fs.readFileSync).toHaveBeenCalledTimes(1);

    // Второй запрос переиспользует закэшированный HTML — файл читается один раз.
    const second = mockReqRes('/articles/skhemy-yanga-spisok');
    await mw.use(second.req, second.res, () => {});
    expect(fs.readFileSync).toHaveBeenCalledTimes(1);
  });
});

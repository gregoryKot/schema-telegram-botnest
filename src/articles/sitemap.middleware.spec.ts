import { SitemapMiddleware } from './sitemap.middleware';
import type { ArticlesService } from './articles.service';

function setup(list: jest.Mock) {
  const mw = new SitemapMiddleware({ list } as unknown as ArticlesService);
  const res = {
    setHeader: jest.fn(),
    send: jest.fn(),
    status: jest.fn().mockReturnThis(),
    type: jest.fn().mockReturnThis(),
  } as any;
  return { mw, res };
}

const article = (over: Record<string, unknown> = {}) => ({
  slug: 'one',
  date: new Date('2025-05-10T00:00:00.000Z'),
  updatedAt: new Date('2025-05-10T00:00:00.000Z'),
  ...over,
});

describe('SitemapMiddleware', () => {
  it('отдаёт XML: статические страницы без lastmod, статьи с lastmod', async () => {
    const list = jest
      .fn()
      .mockResolvedValue([
        article({ slug: 'one', updatedAt: new Date('2026-09-01T10:00:00Z') }),
        article({ slug: 'two', updatedAt: new Date('2024-01-01T00:00:00Z') }),
      ]);
    const { mw, res } = setup(list);
    const next = jest.fn();
    await mw.use({ path: '/sitemap.xml' } as any, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'application/xml; charset=utf-8',
    );
    expect(res.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'public, max-age=3600',
    );
    const xml = res.send.mock.calls[0][0] as string;
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    for (const p of ['/', '/articles', '/privacy', '/offer']) {
      expect(xml).toContain(
        `<url><loc>https://schemehappens.ru${p}</loc></url>`,
      );
    }
    // позднее из date/updatedAt
    expect(xml).toContain(
      '<loc>https://schemehappens.ru/articles/one</loc><lastmod>2026-09-01</lastmod>',
    );
    expect(xml).toContain(
      '<loc>https://schemehappens.ru/articles/two</loc><lastmod>2025-05-10</lastmod>',
    );
    // порядок: статьи между /articles и /privacy
    expect(xml.indexOf('/articles/one')).toBeGreaterThan(
      xml.indexOf('/articles</loc>'),
    );
    expect(xml.indexOf('/privacy')).toBeGreaterThan(
      xml.indexOf('/articles/two'),
    );
    expect(xml).not.toContain('changefreq');
    expect(xml).not.toContain('priority');
  });

  it('слэш в конце пути допустим; & в slug экранируется', async () => {
    const { mw, res } = setup(
      jest.fn().mockResolvedValue([article({ slug: 'a&b' })]),
    );
    await mw.use({ path: '/sitemap.xml/' } as any, res, jest.fn());
    const xml = res.send.mock.calls[0][0] as string;
    expect(xml).toContain('/articles/a&amp;b</loc>');
    expect(xml).not.toContain('a&b');
  });

  it('другой путь → next(), БД не трогаем', async () => {
    const list = jest.fn();
    const { mw, res } = setup(list);
    const next = jest.fn();
    await mw.use({ path: '/robots.txt' } as any, res, next);
    expect(next).toHaveBeenCalledWith();
    expect(list).not.toHaveBeenCalled();
    expect(res.send).not.toHaveBeenCalled();
  });

  it('ошибка БД → 503 с текстом, next не вызывается', async () => {
    const { mw, res } = setup(jest.fn().mockRejectedValue(new Error('db')));
    const next = jest.fn();
    await mw.use({ path: '/sitemap.xml' } as any, res, next);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.send).toHaveBeenCalledWith('sitemap temporarily unavailable');
    expect(next).not.toHaveBeenCalled();
  });
});

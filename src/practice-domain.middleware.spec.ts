// Доменная стратегия практики: kotlarewski.ru — 301 на .gr (пути и query
// сохраняются), kotlarewski.gr отдаёт свои sitemap/robots (не общие статики
// со ссылками schemehappens), остальные домены проходят насквозь.
import { practiceDomainMiddleware } from './practice-domain.middleware';

function run(hostname: string, path: string, originalUrl = path) {
  const req = { hostname, path, originalUrl } as never;
  const sent: {
    redirect?: [number, string];
    type?: string;
    body?: string;
  } = {};
  const res = {
    redirect: (code: number, url: string) => {
      sent.redirect = [code, url];
    },
    type(t: string) {
      sent.type = t;
      return this;
    },
    send: (body: string) => {
      sent.body = body;
    },
  } as never;
  let nextCalled = false;
  practiceDomainMiddleware(req, res, () => {
    nextCalled = true;
  });
  return { sent, nextCalled };
}

describe('practiceDomainMiddleware', () => {
  it('kotlarewski.ru → 301 на kotlarewski.gr с сохранением пути и query', () => {
    const { sent, nextCalled } = run(
      'kotlarewski.ru',
      '/articles',
      '/articles?utm=x',
    );
    expect(sent.redirect).toEqual([
      301,
      'https://kotlarewski.gr/articles?utm=x',
    ]);
    expect(nextCalled).toBe(false);
  });

  it('www.kotlarewski.ru тоже редиректится', () => {
    const { sent } = run('www.kotlarewski.ru', '/');
    expect(sent.redirect).toEqual([301, 'https://kotlarewski.gr/']);
  });

  it('kotlarewski.gr/sitemap.xml отдаёт мини-sitemap только с главной', () => {
    const { sent, nextCalled } = run('kotlarewski.gr', '/sitemap.xml');
    expect(sent.type).toBe('application/xml');
    expect(sent.body).toContain('<loc>https://kotlarewski.gr/</loc>');
    expect(sent.body).not.toContain('schemehappens');
    expect(sent.body).not.toContain('/articles');
    expect(nextCalled).toBe(false);
  });

  it('kotlarewski.gr/robots.txt закрывает продуктовые маршруты, sitemap свой', () => {
    const { sent } = run('kotlarewski.gr', '/robots.txt');
    expect(sent.type).toBe('text/plain');
    expect(sent.body).toContain('Disallow: /articles');
    expect(sent.body).toContain('Sitemap: https://kotlarewski.gr/sitemap.xml');
  });

  it('kotlarewski.gr обычные пути проходят насквозь (SPA)', () => {
    const { sent, nextCalled } = run('kotlarewski.gr', '/');
    expect(sent.redirect).toBeUndefined();
    expect(sent.body).toBeUndefined();
    expect(nextCalled).toBe(true);
  });

  it('schemehappens.ru не трогаем — включая sitemap.xml', () => {
    const { sent, nextCalled } = run('schemehappens.ru', '/sitemap.xml');
    expect(sent.body).toBeUndefined();
    expect(nextCalled).toBe(true);
  });
});

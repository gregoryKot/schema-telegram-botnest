// Доменная стратегия практики (2026-09-16): kotlarewski.ru / www.* — 301 на
// .gr, kotlarewski.gr отдаёт ТОЛЬКО визитку (allow-list страниц/API ниже),
// весь продуктовый путь (включая /app) — 301 на schemehappens.ru,
// schemehappens.ru проходит насквозь без изменений.
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  practiceDomainMiddleware,
  PRACTICE_API_PREFIXES,
  PRACTICE_PAGES,
  PRACTICE_PAGE_PREFIXES,
} from './practice-domain.middleware';

function run(
  hostname: string,
  path: string,
  originalUrl = path,
  method = 'GET',
) {
  const req = { hostname, path, originalUrl, method } as never;
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

  it('www.kotlarewski.gr → 301 на kotlarewski.gr', () => {
    const { sent } = run('www.kotlarewski.gr', '/');
    expect(sent.redirect).toEqual([301, 'https://kotlarewski.gr/']);
  });

  it('kotlarewski.gr/health проходит насквозь: проба живости не должна видеть 301', () => {
    const { sent, nextCalled } = run('kotlarewski.gr', '/health');
    expect(sent.redirect).toBeUndefined();
    expect(nextCalled).toBe(true);
  });

  it('kotlarewski.gr/api/health — такого маршрута нет, это не визитка → 301', () => {
    const { sent } = run('kotlarewski.gr', '/api/health');
    expect(sent.redirect).toEqual([301, 'https://schemehappens.ru/api/health']);
  });

  describe('визитка отдаёт только себя (allow-list)', () => {
    it.each(['/app', '/app/', '/app/assets/index.js', '/app/index.html'])(
      '%s → 301 на schemehappens.ru (мини-апп, всегда продуктовый)',
      (path) => {
        const { sent, nextCalled } = run('kotlarewski.gr', path);
        expect(sent.redirect).toEqual([301, `https://schemehappens.ru${path}`]);
        expect(nextCalled).toBe(false);
      },
    );

    it.each(['/login', '/link', '/tests', '/diary'])(
      '%s → 301 на schemehappens.ru (продуктовый маршрут, не в allow-list)',
      (path) => {
        const { sent, nextCalled } = run('kotlarewski.gr', path);
        expect(sent.redirect).toEqual([301, `https://schemehappens.ru${path}`]);
        expect(nextCalled).toBe(false);
      },
    );

    it('/auth/callback?x=1 → 301 с сохранением query', () => {
      const { sent } = run(
        'kotlarewski.gr',
        '/auth/callback',
        '/auth/callback?x=1',
      );
      expect(sent.redirect).toEqual([
        301,
        'https://schemehappens.ru/auth/callback?x=1',
      ]);
    });

    it('/api/auth/google?ticket=… → 301 (регрессия 2026-09-08, вход через OAuth с алиаса)', () => {
      const { sent, nextCalled } = run(
        'kotlarewski.gr',
        '/api/auth/google',
        '/api/auth/google?ticket=K7M2QX94',
      );
      expect(sent.redirect).toEqual([
        301,
        'https://schemehappens.ru/api/auth/google?ticket=K7M2QX94',
      ]);
      expect(nextCalled).toBe(false);
    });

    it.each(['/api/me', '/api/needs', '/api/therapy/tasks/all'])(
      '%s → 301 (продуктовый API, не в allow-list)',
      (path) => {
        const { sent, nextCalled } = run('kotlarewski.gr', path);
        expect(sent.redirect).toEqual([301, `https://schemehappens.ru${path}`]);
        expect(nextCalled).toBe(false);
      },
    );

    it.each(PRACTICE_API_PREFIXES)(
      '%s и %s/что-то → next (сам префикс и вложенный путь)',
      (prefix) => {
        const own = run('kotlarewski.gr', prefix);
        expect(own.nextCalled).toBe(true);
        expect(own.sent.redirect).toBeUndefined();

        const nested = run('kotlarewski.gr', `${prefix}/что-то`);
        expect(nested.nextCalled).toBe(true);
        expect(nested.sent.redirect).toBeUndefined();
      },
    );

    it('/api/bookingx → 301 (похожий, но незаконный префикс — не подстрока)', () => {
      const { sent, nextCalled } = run('kotlarewski.gr', '/api/bookingx');
      expect(sent.redirect).toEqual([
        301,
        'https://schemehappens.ru/api/bookingx',
      ]);
      expect(nextCalled).toBe(false);
    });

    it('/api/client-errorsx → 301 (похожий, но незаконный префикс — не подстрока)', () => {
      const { sent, nextCalled } = run('kotlarewski.gr', '/api/client-errorsx');
      expect(sent.redirect).toEqual([
        301,
        'https://schemehappens.ru/api/client-errorsx',
      ]);
      expect(nextCalled).toBe(false);
    });

    it('/api/articles-admin-x → 301 (похожий, но незаконный префикс)', () => {
      const { sent, nextCalled } = run(
        'kotlarewski.gr',
        '/api/articles-admin-x',
      );
      expect(sent.redirect).toEqual([
        301,
        'https://schemehappens.ru/api/articles-admin-x',
      ]);
      expect(nextCalled).toBe(false);
    });

    it.each(PRACTICE_PAGES)('страница %s → next', (page) => {
      const { sent, nextCalled } = run('kotlarewski.gr', page);
      expect(nextCalled).toBe(true);
      expect(sent.redirect).toBeUndefined();
    });

    it('/articles/some-slug → next (страница с параметром)', () => {
      const { sent, nextCalled } = run('kotlarewski.gr', '/articles/some-slug');
      expect(nextCalled).toBe(true);
      expect(sent.redirect).toBeUndefined();
    });

    it('/donate/ (хвостовой слэш) → next, как /donate', () => {
      const { nextCalled } = run('kotlarewski.gr', '/donate/');
      expect(nextCalled).toBe(true);
    });

    it('/privacy2 → 301 (похожая, но незаконная страница)', () => {
      const { sent, nextCalled } = run('kotlarewski.gr', '/privacy2');
      expect(sent.redirect).toEqual([301, 'https://schemehappens.ru/privacy2']);
      expect(nextCalled).toBe(false);
    });

    it.each([
      '/assets/index-abc.js',
      '/favicon-personal-32.png',
      '/fonts/a.woff2',
      '/og-cover-v3.jpg', // og:image главной визитки
      '/gregory.jpg', // image в JSON-LD Person
    ])('статика %s → next', (path) => {
      const { sent, nextCalled } = run('kotlarewski.gr', path);
      expect(nextCalled).toBe(true);
      expect(sent.redirect).toBeUndefined();
    });

    it('/app/assets/index.js → 301, а не next (мини-апп важнее статики)', () => {
      const { sent, nextCalled } = run(
        'kotlarewski.gr',
        '/app/assets/index.js',
      );
      expect(sent.redirect).toEqual([
        301,
        'https://schemehappens.ru/app/assets/index.js',
      ]);
      expect(nextCalled).toBe(false);
    });
  });

  // Аудит 2026-10 (I1): allow-list действовал только на GET — запись
  // (POST/PUT/PATCH/DELETE) на алиасе доходила до любой ручки, включая
  // /api/auth/**. Сам middleware метод не различает, поэтому защиту держат
  // два теста: вердикт для записи и РЕГИСТРАЦИЯ на всех методах в AppModule.
  describe('запись на алиасе: allow-list действует на все методы', () => {
    it('POST /api/auth/refresh → 301 на канонический хост', () => {
      const { sent, nextCalled } = run(
        'kotlarewski.gr',
        '/api/auth/refresh',
        '/api/auth/refresh',
        'POST',
      );
      expect(sent.redirect).toEqual([
        301,
        'https://schemehappens.ru/api/auth/refresh',
      ]);
      expect(nextCalled).toBe(false);
    });

    it('POST /api/booking (запись на консультацию визитки) → проходит', () => {
      const { sent, nextCalled } = run(
        'kotlarewski.gr',
        '/api/booking',
        '/api/booking',
        'POST',
      );
      expect(sent.redirect).toBeUndefined();
      expect(nextCalled).toBe(true);
    });

    it.each(['DELETE', 'PATCH', 'PUT'])(
      '%s /api/therapy/x на алиасе → 301',
      (method) => {
        const { sent } = run(
          'kotlarewski.gr',
          '/api/therapy/x',
          '/api/therapy/x',
          method,
        );
        expect(sent.redirect?.[0]).toBe(301);
      },
    );

    // Читаем исходник, а не собираем AppModule: его импорт тянет весь граф
    // (jose и т. п.), а проверяется одна строка регистрации.
    it('AppModule вешает practiceDomainMiddleware на ВСЕ методы, не только GET', () => {
      const src = readFileSync(join(__dirname, 'app.module.ts'), 'utf8');
      const m = src.match(
        /\.apply\(practiceDomainMiddleware\)\s*\.forRoutes\([\s\S]*?\);/,
      );
      expect(m).not.toBeNull();
      expect(m![0]).toContain('RequestMethod.ALL');
      expect(m![0]).not.toContain('RequestMethod.GET');
    });
  });

  it('schemehappens.ru: /login, /app/, /api/auth/google проходят насквозь — allow-list алиаса не действует', () => {
    for (const path of ['/login', '/app/', '/api/auth/google']) {
      const { sent, nextCalled } = run('schemehappens.ru', path);
      expect(sent.redirect).toBeUndefined();
      expect(nextCalled).toBe(true);
    }
  });

  // Правило №4 CLAUDE.md: два места, обязанные совпадать, фиксируются
  // тестом. Источник правды на фронте — personalRoutes в webapp/src/App.tsx:
  // если там добавят страницу визитки и забудут middleware (или наоборот),
  // тест обязан упасть.
  describe('PRACTICE_PAGES/PRACTICE_PAGE_PREFIXES ⇄ personalRoutes (webapp/src/App.tsx)', () => {
    const appTsx = readFileSync(
      join(__dirname, '..', 'webapp/src/App.tsx'),
      'utf8',
    );
    const blockMatch = /const personalRoutes = \[([\s\S]*?)\n\];/.exec(appTsx);
    if (!blockMatch) {
      throw new Error(
        'блок `const personalRoutes = [ … ];` не найден в webapp/src/App.tsx — ' +
          'тест-сверка с PRACTICE_PAGES не может сработать, обнови регэксп теста',
      );
    }
    const block = blockMatch[1];
    const paths = [...block.matchAll(/path: '([^']+)'/g)].map((m) => m[1]);

    const pages = paths.filter((p) => p !== '*' && !p.includes(':'));
    const prefixes = paths
      .filter((p) => p.includes(':'))
      .map((p) => p.slice(0, p.lastIndexOf('/') + 1));

    it('страницы без параметра совпадают с PRACTICE_PAGES', () => {
      expect(new Set(pages)).toEqual(new Set(PRACTICE_PAGES));
    });

    it('префиксы страниц с параметром совпадают с PRACTICE_PAGE_PREFIXES', () => {
      expect(new Set(prefixes)).toEqual(new Set(PRACTICE_PAGE_PREFIXES));
    });
  });
});

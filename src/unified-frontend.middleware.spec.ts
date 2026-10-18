// Оба исхода: флаг выключен — /app/* проходит как раньше; включён — 302 в
// кабинет, заглушка SW, остальные методы и чужие пути не тронуты.
import {
  configureUnifiedFrontend,
  isUnifiedFrontendOn,
  unifiedFrontendMiddleware,
} from './unified-frontend.middleware';
import { SW_STUB_SOURCE } from './unified-frontend.sw-stub';

function run(path: string, originalUrl = path, method = 'GET') {
  const out: {
    redirect?: [number, string];
    status?: number;
    body?: string;
    headers?: Record<string, string>;
  } = {};
  const res = {
    redirect: (c: number, u: string) => {
      out.redirect = [c, u];
    },
    status(s: number) {
      out.status = s;
      return this;
    },
    set(h: Record<string, string>) {
      out.headers = h;
      return this;
    },
    send: (b: string) => {
      out.body = b;
    },
  };
  let next = false;
  unifiedFrontendMiddleware(
    { path, originalUrl, method } as never,
    res as never,
    () => {
      next = true;
    },
  );
  return { ...out, next };
}

describe('unifiedFrontendMiddleware', () => {
  const prev = process.env.UNIFIED_FRONTEND;
  afterEach(() => {
    if (prev === undefined) delete process.env.UNIFIED_FRONTEND;
    else process.env.UNIFIED_FRONTEND = prev;
  });

  it('флаг выключен: /app/x и /app/sw.js проходят дальше', () => {
    delete process.env.UNIFIED_FRONTEND;
    expect(run('/app/x').next).toBe(true);
    expect(run('/app/sw.js').next).toBe(true);
    process.env.UNIFIED_FRONTEND = '0';
    expect(run('/app/').next).toBe(true);
  });

  describe('флаг включён', () => {
    beforeEach(() => {
      process.env.UNIFIED_FRONTEND = '1';
    });

    it('302 на /today с переносом query', () => {
      const r = run('/app/', '/app/?startapp=pair_abc&from=app');
      expect(r.redirect).toEqual([302, '/today?startapp=pair_abc&from=app']);
      expect(r.next).toBe(false);
    });

    it('/app без слэша и глубокие пути тоже; без query — чистый /today', () => {
      expect(run('/app').redirect).toEqual([302, '/today']);
      expect(
        run('/app/assets/a.js', '/app/assets/a.js?section=x').redirect,
      ).toEqual([302, '/today?section=x']);
    });

    it('HEAD редиректится так же', () => {
      expect(run('/app/', '/app/', 'HEAD').redirect?.[0]).toBe(302);
    });

    it('/app/sw.js — заглушка, no-store, без редиректа', () => {
      const r = run('/app/sw.js', '/app/sw.js?v=1');
      expect(r.redirect).toBeUndefined();
      expect(r.status).toBe(200);
      expect(r.body).toBe(SW_STUB_SOURCE);
      expect(r.headers?.['Cache-Control']).toBe('no-store');
      expect(r.headers?.['Content-Type']).toContain('application/javascript');
      expect(SW_STUB_SOURCE).toContain('skipWaiting');
      expect(SW_STUB_SOURCE).toContain('caches.delete');
      expect(SW_STUB_SOURCE).toContain('unregister');
    });

    it('POST /app/... проходит дальше', () => {
      expect(run('/app/x', '/app/x', 'POST').next).toBe(true);
    });

    it('имя сверяется целиком: /apple-touch-icon.png и /application не тронуты', () => {
      expect(run('/apple-touch-icon.png').next).toBe(true);
      expect(run('/application').next).toBe(true);
      expect(run('/today').next).toBe(true);
    });
  });

  it('isUnifiedFrontendOn: 1/true включают, остальное нет', () => {
    expect(isUnifiedFrontendOn('true')).toBe(true);
    expect(isUnifiedFrontendOn(' 1 ')).toBe(true);
    expect(isUnifiedFrontendOn('yes')).toBe(false);
    expect(isUnifiedFrontendOn('')).toBe(false);
  });

  it('configureUnifiedFrontend вешает middleware на все маршруты', () => {
    const forRoutes = jest.fn();
    const apply = jest.fn().mockReturnValue({ forRoutes });
    configureUnifiedFrontend({ apply });
    expect(apply).toHaveBeenCalledWith(unifiedFrontendMiddleware);
    expect(forRoutes).toHaveBeenCalledTimes(1);
  });
});

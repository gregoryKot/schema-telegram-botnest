// @vitest-environment jsdom
// App.tsx — маршрутизация корневого компонента: два набора роутов (личный
// сайт kotlarewski vs. продуктовый app-домен, определяется по hostname),
// защита приватных маршрутов через RequireAuth, страница ошибки входа,
// Метрика-трекер и мост токена в api-клиент. Каждый сценарий пересоздаёт
// модуль (`vi.resetModules`), потому что isPersonalSite и сам router строятся
// один раз при импорте — единственный способ переключить домен между тестами.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';

vi.mock('../../shared/src/host', () => ({
  getHost: () => ({ sessionExchange: () => null }),
}));

// jsdom не реализует IntersectionObserver (LandingPage → useReveal) — тот же
// минимальный мок, что в LandingPage.test.tsx.
class MockIntersectionObserver {
  observe() {}
  disconnect() {}
  unobserve() {}
}

let fetchMock: ReturnType<typeof vi.fn>;

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) };
}

function stubLocation(overrides: Partial<Record<'hostname' | 'pathname' | 'search' | 'hash' | 'href', string>>) {
  vi.stubGlobal('location', {
    ...window.location,
    hostname: 'localhost',
    pathname: '/',
    search: '',
    hash: '',
    href: 'http://localhost/',
    ...overrides,
  });
}

async function loadApp() {
  vi.resetModules();
  const mod = await import('./App');
  return mod.default;
}

beforeEach(() => {
  // По умолчанию — «не залогинен»: /api/auth/refresh отвечает 401, RequireAuth
  // не блокируется навсегда. Тесты, которым нужен вход, переопределяют это.
  fetchMock = vi.fn().mockResolvedValue(jsonResponse(401, {}));
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('App — публичные маршруты app-домена', () => {
  it('/login показывает три способа входа', async () => {
    stubLocation({ pathname: '/login', href: 'http://localhost/login' });
    const App = await loadApp();
    render(<App />);
    await screen.findByRole('button', { name: /Войти через Google/ });
  });

  it('/ на app-домене — продуктовый лендинг (document.title)', async () => {
    stubLocation({ pathname: '/', href: 'http://localhost/' });
    const App = await loadApp();
    render(<App />);
    await waitFor(() => expect(document.title).toBe('Всё по схеме — инструмент схема-терапии'));
  });

  it('/tests доступен на app-домене (мини-тесты — публичный лид-магнит)', async () => {
    stubLocation({ pathname: '/tests', href: 'http://localhost/tests' });
    const App = await loadApp();
    render(<App />);
    await waitFor(() => expect(document.title).toBe('Мини-тесты — Всё по схеме'));
  });
});

describe('App — личный сайт (домен kotlarewski)', () => {
  it('/ показывает лендинг практики, а не продуктовый', async () => {
    stubLocation({ hostname: 'kotlarewski.example', pathname: '/', href: 'http://kotlarewski.example/' });
    const App = await loadApp();
    render(<App />);
    await waitFor(() => expect(screen.getAllByText('Григорий Котляревский').length).toBeGreaterThan(0));
  });

  it('favicon переключается на персональный', async () => {
    // jsdom не реализует HTMLLinkElement.sizes (DOMTokenList) — ветка
    // `sizes?.value === '96x96'` физически недостижима в этом окружении,
    // проверяем достижимую ветку (обычная link-иконка без sizes).
    const link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
    try {
      stubLocation({ hostname: 'kotlarewski.example', pathname: '/', href: 'http://kotlarewski.example/' });
      await loadApp();
      expect(link.href).toContain('favicon-personal-32.png');
      expect(link.type).toBe('image/png');
    } finally {
      link.remove();
    }
  });

  it('?site=personal на любом хосте тоже включает личный сайт', async () => {
    stubLocation({ pathname: '/', search: '?site=personal', href: 'http://localhost/?site=personal' });
    const App = await loadApp();
    render(<App />);
    await waitFor(() => expect(screen.getAllByText('Григорий Котляревский').length).toBeGreaterThan(0));
  });
});

describe('App — защищённые маршруты (RequireAuth)', () => {
  it('неавторизованный визит на /account уводит на /login', async () => {
    stubLocation({ pathname: '/account', href: 'http://localhost/account' });
    const App = await loadApp();
    render(<App />);
    await screen.findByRole('button', { name: /Войти через Google/ });
  });

  it('авторизованный пользователь реально попадает на защищённую страницу (не редиректится на /login)', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (String(url).includes('/api/auth/refresh')) {
        return Promise.resolve(jsonResponse(200, { accessToken: 'tok', expiresIn: 900 }));
      }
      // AccountPage тоже что-то запросит — 401 ей не помешает отрендериться.
      return Promise.resolve(jsonResponse(401, {}));
    });
    stubLocation({ pathname: '/account', href: 'http://localhost/account' });
    const App = await loadApp();
    render(<App />);

    await screen.findByText('Аккаунт');
    expect(screen.queryByRole('button', { name: /Войти через Google/ })).toBeNull();
  });

  it('пока идёт проверка сессии — виден лоадер, а не пустой экран или чужая страница', async () => {
    let resolveRefresh!: (v: unknown) => void;
    fetchMock.mockReturnValue(new Promise((r) => { resolveRefresh = r; }));
    stubLocation({ pathname: '/account', href: 'http://localhost/account' });
    const App = await loadApp();
    const { container } = render(<App />);

    expect(container.querySelector('.loader-center')).toBeTruthy();
    resolveRefresh(jsonResponse(401, {}));
    await screen.findByRole('button', { name: /Войти через Google/ });
  });

  // Диагностика «постоянно нужно логиниться заново» (2026-08-21): 5xx на
  // /api/auth/refresh раньше вёл себя как 401 и редиректил на /login поверх
  // живой куки. Теперь — «нет связи», НЕ /login.
  it('5xx на /api/auth/refresh — «нет связи», а не редирект на /login (2026-08-21)', async () => {
    fetchMock.mockResolvedValue(jsonResponse(500, {}));
    stubLocation({ pathname: '/account', href: 'http://localhost/account' });
    const App = await loadApp();
    render(<App />);

    await screen.findByText('Нет связи с сервером', {}, { timeout: 3000 });
    expect(screen.queryByRole('button', { name: /Войти через Google/ })).toBeNull();
  });
});

describe('App — страница ошибки входа (/auth/error)', () => {
  it('показывает причину из query-параметра', async () => {
    stubLocation({ pathname: '/auth/error', search: '?reason=telegram_mismatch', href: 'http://localhost/auth/error?reason=telegram_mismatch' });
    const App = await loadApp();
    render(<App />);
    await screen.findByText('telegram_mismatch');
    expect(screen.getByText('Что-то')).toBeTruthy();
  });

  it('без причины — блок с текстом ошибки не рисуется вовсе', async () => {
    stubLocation({ pathname: '/auth/error', href: 'http://localhost/auth/error' });
    const App = await loadApp();
    const { container } = render(<App />);
    await screen.findByText('Что-то');
    expect(container.querySelector('[style*="monospace"]')).toBeNull();
  });
});

describe('App — Яндекс.Метрика SPA-трекинг', () => {
  it('шлёт hit БЕЗ фрагмента — токен из #access_token не утекает в Метрику (L6)', async () => {
    const ym = vi.fn();
    (window as unknown as { ym: typeof ym }).ym = ym;
    stubLocation({ pathname: '/auth/callback', href: 'http://localhost/auth/callback#access_token=SECRET_JWT&expires_in=900' });
    const App = await loadApp();
    render(<App />);
    await waitFor(() => expect(ym).toHaveBeenCalled());
    expect(ym.mock.calls[0][1]).toBe('hit');
    const urlArg = String(ym.mock.calls[0][2]);
    expect(urlArg).toBe('http://localhost/auth/callback'); // фрагмент срезан
    expect(urlArg).not.toContain('SECRET_JWT');
    delete (window as unknown as { ym?: typeof ym }).ym;
  });
});

describe('App — токен-мост (TokenBridge → api-клиент)', () => {
  it('после проверки сессии api-клиент реально получает функцию-провайдер токена', async () => {
    vi.doMock('./api', async (importOriginal) => {
      const actual = await importOriginal<typeof import('./api')>();
      return { ...actual, setTokenProvider: vi.fn(actual.setTokenProvider) };
    });
    stubLocation({ pathname: '/login', href: 'http://localhost/login' });
    const App = await loadApp();
    const { setTokenProvider } = await import('./api');
    const spy = setTokenProvider as unknown as ReturnType<typeof vi.fn>;
    render(<App />);

    await waitFor(() => expect(spy).toHaveBeenCalled());
    // Без сохранённой сессии провайдер отдаёт null — заголовок Authorization
    // в api-клиенте реально не появится (не просто «функция была вызвана»).
    const provider = spy.mock.calls[spy.mock.calls.length - 1][0] as () => string | null;
    expect(provider()).toBeNull();
  });
});

// @vitest-environment jsdom
// Приём сессии после OAuth. С 2026-11 сервер ведёт на /auth/callback БЕЗ
// токена в адресе: сессию поднимает AuthProvider refresh-ом по куке из того же
// редиректа, а фрагмент страница не читает вовсе (login-CSRF, аудит 2026-11).
//
// returnTo из sessionStorage (auth_return_to) может указывать ВНЕ SPA сайта —
// на /app/…, куда LoginScreen кладёт этот ключ перед уходом на OAuth. У сайта
// нет react-router маршрута /app — navigate() туда покажет пустоту, поэтому
// такой returnTo обязан уйти полным переходом (window.location.replace).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor, cleanup, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useSearchParams } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthProvider';
import { useAuth } from '../auth/authContext';
import { resetRefreshLockForTests } from '../auth/refreshSession';
import { AuthCallback } from './AuthCallback';

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

// Ненастоящие JWT: подпись не нужна, фронт читает только `sub` (dataOwnerGuard).
const jwt = (sub: string) => `h.${btoa(JSON.stringify({ sub }))}.s`;
const OWN = jwt('42');
const FOREIGN = jwt('99');

let fetchMock: ReturnType<typeof vi.fn>;
let refreshReplies: Response[];
// window.location.replace не переопределяется через vi.spyOn в jsdom
// (навигация — не конфигурируемое свойство) — подменяем сам объект location.
const originalLocation = window.location;
let replaceSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  resetRefreshLockForTests();
  // По умолчанию refresh-кука жива: сервер поставил её в редиректе OAuth.
  refreshReplies = [];
  fetchMock = vi.fn((url: string) => {
    if (String(url).endsWith('/api/auth/refresh')) {
      return Promise.resolve(
        refreshReplies.shift() ?? jsonResponse(200, { accessToken: OWN, expiresIn: 900 }),
      );
    }
    return Promise.resolve(jsonResponse(404, {}));
  });
  vi.stubGlobal('fetch', fetchMock);
  sessionStorage.clear();
  localStorage.clear();
  replaceSpy = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  resetRefreshLockForTests();
  sessionStorage.clear();
  localStorage.clear();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: originalLocation,
  });
});

function LoginProbe() {
  const [params] = useSearchParams();
  return <div>login-page error={params.get('error') ?? 'none'}</div>;
}

// Все токены, которые хоть раз побывали в AuthProvider.
let seenTokens: (string | null)[] = [];
function TokenProbe() {
  seenTokens.push(useAuth().accessToken);
  return null;
}

// MemoryRouter управляет только react-router-местоположением, а страница
// стирает НАСТОЯЩИЙ window.location.hash — кладём его в стаб location.
function renderAt(hash: string, returnTo?: string) {
  seenTokens = [];
  if (returnTo) sessionStorage.setItem('auth_return_to', returnTo);
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...originalLocation, hash, replace: replaceSpy },
  });
  return render(
    <MemoryRouter initialEntries={['/auth/callback']}>
      <AuthProvider>
        <TokenProbe />
        <Routes>
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/today" element={<div>today-page</div>} />
          <Route path="/login" element={<LoginProbe />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

const refreshCalls = () =>
  fetchMock.mock.calls.filter((c) => String(c[0]).endsWith('/api/auth/refresh'));

describe('AuthCallback — returnTo ведёт на мини-апп (/app/…)', () => {
  it('уходит полным переходом через window.location.replace, а не navigate', async () => {
    const { queryByText } = renderAt('', '/app/');

    await waitFor(() => expect(replaceSpy).toHaveBeenCalledWith('/app/'));
    // navigate() к SPA-маршруту не сработал — «/today» не отрендерился.
    expect(queryByText('today-page')).toBeNull();
  });
});

describe('AuthCallback — returnTo ведёт на обычный маршрут сайта', () => {
  it('сессия из refresh-куки → navigate() на returnTo, без window.location.replace', async () => {
    const { findByText } = renderAt('', '/today');

    await findByText('today-page');
    expect(replaceSpy).not.toHaveBeenCalled();
    // Сессию дал ровно один refresh — страница второй не зовёт.
    expect(refreshCalls()).toHaveLength(1);
    expect(seenTokens).toContain(OWN);
  });

  it('без сохранённого returnTo — дефолт /today через navigate()', async () => {
    const { findByText } = renderAt('');

    await findByText('today-page');
    expect(replaceSpy).not.toHaveBeenCalled();
  });
});

// Ошибка провайдера (отменил OAuth, кука не выдана) — увести на /login с
// причиной, а не оставить человека висеть на заглушке загрузки.
describe('AuthCallback — сессии нет (refresh 401)', () => {
  it('уходит на /login?error=no_token через navigate(), не через window.location.replace', async () => {
    refreshReplies = [jsonResponse(401, {})];
    const { findByText } = renderAt('');

    await findByText('login-page error=no_token');
    expect(replaceSpy).not.toHaveBeenCalled();
  });
});

// Сеть/5xx на refresh — сессия, может быть, жива: не выкидывать на /login,
// а дождаться ретрая AuthProvider, который сам её поднимет.
describe('AuthCallback — refresh временно недоступен (сеть/5xx)', () => {
  it('ждёт ретрая AuthProvider и входит, не уходя на /login', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    // Первый круг (3 попытки внутри refreshSession) — 503, ретрай — 200.
    refreshReplies = [jsonResponse(503, {}), jsonResponse(503, {}), jsonResponse(503, {})];
    const { queryByText } = renderAt('', '/today');

    await act(async () => { await vi.advanceTimersByTimeAsync(2_500); });
    expect(refreshCalls()).toHaveLength(3);
    expect(queryByText(/login-page/)).toBeNull();
    expect(queryByText('today-page')).toBeNull();

    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(queryByText('today-page')).not.toBeNull();
    expect(queryByText(/login-page/)).toBeNull();
  });
});

// Login-CSRF (аудит 2026-11): атакующий шлёт ссылку со СВОИМ токеном во
// фрагменте. Раньше жертва молча входила в его аккаунт и писала туда дневники,
// а ensureDataOwner по чужому `sub` стирал её несинхронизированные черновики.
describe('AuthCallback — подброшенный #access_token не принимается (регресс)', () => {
  it('refresh 401 → не авторизованы, /login?error=no_token, чужого токена нет, черновики целы', async () => {
    localStorage.setItem('data_owner_id', '42');
    localStorage.setItem('diary_draft', 'несинхронизированный черновик');
    refreshReplies = [jsonResponse(401, {})];
    const { findByText } = renderAt(`#access_token=${FOREIGN}&expires_in=99999`, '/today');

    await findByText('login-page error=no_token');
    expect(seenTokens).not.toContain(FOREIGN);
    expect(seenTokens.every((t) => t === null)).toBe(true);
    expect(localStorage.getItem('data_owner_id')).toBe('42');
    expect(localStorage.getItem('diary_draft')).toBe('несинхронизированный черновик');
  });

  it('с живой кукой сессия — своя (из refresh), а не из фрагмента', async () => {
    const { findByText } = renderAt(`#access_token=${FOREIGN}&expires_in=99999`, '/today');

    await findByText('today-page');
    expect(seenTokens).toContain(OWN);
    expect(seenTokens).not.toContain(FOREIGN);
  });
});

// Аудит 2026-10, E3: раньше при window.opener токен из хэша уходил в
// opener.location.href — в окно, чьё происхождение никто не проверял. Попап-входа
// нет, ветка удалена: opener не трогаем, вход идёт обычным путём.
describe('AuthCallback — window.opener не получает токен', () => {
  it('с чужим opener присваивания location.href нет, вход завершается как обычно', async () => {
    const hrefSet = vi.fn();
    const foreignOpener = {
      get location() {
        return {
          get href() { return ''; },
          set href(v: string) { hrefSet(v); },
        };
      },
    };
    const closeSpy = vi.spyOn(window, 'close').mockImplementation(() => undefined);
    Object.defineProperty(window, 'opener', { configurable: true, value: foreignOpener });
    try {
      const { findByText } = renderAt('', '/today');
      await findByText('today-page');
      expect(hrefSet).not.toHaveBeenCalled();
      expect(closeSpy).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(window, 'opener', { configurable: true, value: null });
      closeSpy.mockRestore();
    }
  });
});

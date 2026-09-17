// @vitest-environment jsdom
// Callback от oauth.telegram.org: данные приходят в hash-фрагменте ИЛИ в
// query (см. telegramAuthResult.test.ts для чистого разбора форматов),
// декодируются на клиенте и уходят на /api/auth/telegram/widget. Три исхода
// (успех/TOTP/merge) + разбор ошибок — образец мокинга window.location:
// AuthCallback.test.tsx.
//
// Симптом 2026-08-21: «первый вход падал, второй проходил» — покрыт блоком
// «три формата возврата» ниже (query tgAuthResult и плоский id+hash — форматы
// ПЕРВОГО входа, hash — обычно повторного).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, findByText as domFindByText, cleanup, act } from '@testing-library/react';
import { StrictMode } from 'react';
import { MemoryRouter, Routes, Route, useSearchParams } from 'react-router-dom';
import { AuthContext, type AuthState } from '../auth/authContext';
import { TelegramWidgetCallback } from './TelegramWidgetCallback';

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

function b64url(obj: unknown): string {
  return btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_');
}

let fetchMock: ReturnType<typeof vi.fn>;
const originalLocation = window.location;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  sessionStorage.clear();
  Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
});

function authValue(overrides: Partial<AuthState> = {}): AuthState {
  return {
    accessToken: null, isLoading: false, isAuthenticated: false,
    setAccessToken: vi.fn(), logout: vi.fn(), refreshToken: vi.fn(),
    ...overrides,
  };
}

function ErrorProbe() {
  const [params] = useSearchParams();
  return <div>error-page reason={params.get('reason') ?? 'none'}</div>;
}

function stubLocation(overrides: { hash?: string; search?: string; replace?: (url: string) => void }) {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...originalLocation, hash: '', search: '', ...overrides },
  });
}

function renderWith(hash: string, auth: AuthState = authValue(), search = '') {
  stubLocation({ hash, search });
  return render(
    <MemoryRouter initialEntries={['/auth/telegram']}>
      <AuthContext.Provider value={auth}>
        <Routes>
          <Route path="/auth/telegram" element={<TelegramWidgetCallback />} />
          <Route path="/today" element={<div>today-page</div>} />
          <Route path="/auth/2fa" element={<div>2fa-page</div>} />
          <Route path="/account/merge" element={<div>merge-page</div>} />
          <Route path="/auth/error" element={<ErrorProbe />} />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

describe('TelegramWidgetCallback — нет данных / битые данные', () => {
  it('без tgAuthResult в хэше и в query — уходит на /auth/error?reason=telegram_no_data', async () => {
    const { findByText } = renderWith('');
    await findByText('error-page reason=telegram_no_data');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('нечитаемый base64/JSON — telegram_decode_error, не падает', async () => {
    const { findByText } = renderWith('#tgAuthResult=not-valid-base64!!!');
    await findByText('error-page reason=telegram_decode_error');
  });
});

describe('TelegramWidgetCallback — успешный вход', () => {
  it('accessToken из ответа сохраняется, уходит на /today (по умолчанию)', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { accessToken: 'tok-tg', expiresIn: 900 }));
    const setAccessToken = vi.fn();
    const { findByText } = renderWith(
      `#tgAuthResult=${b64url({ id: 1, first_name: 'A', hash: 'x' })}`,
      authValue({ setAccessToken }),
    );

    await findByText('today-page');
    expect(setAccessToken).toHaveBeenCalledWith('tok-tg', 900);
  });

  it('сохранённый auth_return_to (из мини-аппа) используется вместо /today', async () => {
    sessionStorage.setItem('auth_return_to', '/schemas');
    fetchMock.mockResolvedValue(jsonResponse(200, { accessToken: 'tok-tg', expiresIn: 900 }));
    stubLocation({ hash: `#tgAuthResult=${b64url({ id: 1, hash: 'x' })}` });
    const { findByText } = render(
      <MemoryRouter initialEntries={['/auth/telegram']}>
        <AuthContext.Provider value={authValue()}>
          <Routes>
            <Route path="/auth/telegram" element={<TelegramWidgetCallback />} />
            <Route path="/schemas" element={<div>schemas-page</div>} />
          </Routes>
        </AuthContext.Provider>
      </MemoryRouter>,
    );
    await findByText('schemas-page');
    expect(sessionStorage.getItem('auth_return_to')).toBeNull();
  });
});

// П4: returnTo из мини-аппа ведёт на /app/… — у сайта нет такого react-router
// маршрута, поэтому нужен полный переход window.location.replace, а не
// navigate() (образец: AuthCallback.test.tsx, «returnTo ведёт на мини-апп»).
describe('TelegramWidgetCallback — возврат в мини-апп', () => {
  it('auth_return_to=/app/... уходит полным переходом через window.location.replace, а не navigate', async () => {
    sessionStorage.setItem('auth_return_to', '/app/');
    fetchMock.mockResolvedValue(jsonResponse(200, { accessToken: 'tok-tg', expiresIn: 900 }));
    const replaceSpy = vi.fn();
    stubLocation({ hash: `#tgAuthResult=${b64url({ id: 1, hash: 'x' })}`, replace: replaceSpy });

    render(
      <MemoryRouter initialEntries={['/auth/telegram']}>
        <AuthContext.Provider value={authValue()}>
          <Routes>
            <Route path="/auth/telegram" element={<TelegramWidgetCallback />} />
            <Route path="/today" element={<div>today-page</div>} />
          </Routes>
        </AuthContext.Provider>
      </MemoryRouter>,
    );

    await vi.waitFor(() => expect(replaceSpy).toHaveBeenCalledWith('/app/'));
  });
});

describe('TelegramWidgetCallback — три формата возврата (симптом 2026-08-21)', () => {
  it('query ?tgAuthResult=... (не hash) — тоже успешный вход, а не telegram_no_data', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { accessToken: 'tok-tg', expiresIn: 900 }));
    const { findByText } = renderWith('', authValue(), `?tgAuthResult=${b64url({ id: 1, hash: 'x' })}`);
    await findByText('today-page');
  });

  it('плоский query ?id=...&hash=... (без обёртки tgAuthResult) — тоже успешный вход', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { accessToken: 'tok-tg', expiresIn: 900 }));
    const { findByText } = renderWith('', authValue(), '?id=555&hash=deadbeef&first_name=A');
    await findByText('today-page');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/telegram/widget'),
      expect.objectContaining({ body: JSON.stringify({ id: '555', hash: 'deadbeef', first_name: 'A' }) }),
    );
  });
});

describe('TelegramWidgetCallback — TOTP и merge', () => {
  it('totp=true уводит на /auth/2fa с challengeToken', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { totp: true, challengeToken: 'chal1' }));
    const { findByText } = renderWith(`#tgAuthResult=${b64url({ id: 1, hash: 'x' })}`);
    await findByText('2fa-page');
  });

  it('merge=true уводит на /account/merge с параметрами слияния', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {
      merge: true, mergeToken: 'merge1', summary: { Rating: 3 }, provider: 'telegram', otherDisplay: 'user',
    }));
    const { findByText } = renderWith(`#tgAuthResult=${b64url({ id: 1, hash: 'x' })}`);
    await findByText('merge-page');
  });
});

describe('TelegramWidgetCallback — ошибка сервера', () => {
  it('не-ok ответ — уходит на /auth/error с причиной из тела ответа', async () => {
    fetchMock.mockResolvedValue({
      ok: false, status: 403,
      json: () => Promise.resolve({ message: 'invalid_hash' }),
    } as unknown as Response);
    const { findByText } = renderWith(`#tgAuthResult=${b64url({ id: 1, hash: 'x' })}`);
    await findByText('error-page reason=invalid_hash');
  });

  it('сетевая ошибка (fetch reject) — telegram_failed, не падает белым экраном', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));
    const { findByText } = renderWith(`#tgAuthResult=${b64url({ id: 1, hash: 'x' })}`);
    await findByText('error-page reason=telegram_failed');
  });
});

// П3: раньше history.replaceState стирал hash ДО fetch — второй прогон
// эффекта (или перезагрузка страницы во время ожидания ответа) читал уже
// пустой URL и падал в telegram_no_data.
describe('TelegramWidgetCallback — очистка URL и повторный запуск эффекта (симптом 2026-08-21)', () => {
  it('history.replaceState вызывается ПОСЛЕ ответа fetch, не до него', async () => {
    let resolveFetch!: (v: Response) => void;
    fetchMock.mockReturnValue(new Promise<Response>((r) => { resolveFetch = r; }));
    const replaceStateSpy = vi.spyOn(window.history, 'replaceState');
    renderWith(`#tgAuthResult=${b64url({ id: 1, hash: 'x' })}`);

    // fetch запущен, но ответа ещё нет — адрес обязан остаться нетронутым.
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(replaceStateSpy).not.toHaveBeenCalled();

    await act(async () => { resolveFetch(jsonResponse(200, { accessToken: 'tok-tg', expiresIn: 900 })); });
    await vi.waitFor(() => expect(replaceStateSpy).toHaveBeenCalledWith(null, '', '/auth/telegram'));
    replaceStateSpy.mockRestore();
  });

  it('StrictMode (двойной запуск эффекта) — fetch уходит один раз благодаря useRef-стражу', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { accessToken: 'tok-tg', expiresIn: 900 }));
    stubLocation({ hash: `#tgAuthResult=${b64url({ id: 1, hash: 'x' })}` });
    const { container } = render(
      <StrictMode>
        <MemoryRouter initialEntries={['/auth/telegram']}>
          <AuthContext.Provider value={authValue()}>
            <Routes>
              <Route path="/auth/telegram" element={<TelegramWidgetCallback />} />
              <Route path="/today" element={<div>today-page</div>} />
            </Routes>
          </AuthContext.Provider>
        </MemoryRouter>
      </StrictMode>,
    );

    await domFindByText(container, 'today-page');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

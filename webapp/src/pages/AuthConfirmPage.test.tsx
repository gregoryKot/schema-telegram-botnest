// @vitest-environment jsdom
// Экран сверки входа по билету — человек в цикле (разбор 2026-08-31).
//
// Держим ядро фикса device-code phishing: сервер больше не одобряет билет за
// вошедшего молча — одобрение здесь, явным нажатием, и «это не я» гасит билет.
// Мокаем global fetch напрямую (компонент ходит через fetch) — образец
// TwoFactorChallengePage.test.tsx.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthContext, type AuthState } from '../auth/authContext';
import { AuthProvider } from '../auth/AuthProvider';
import { resetRefreshLockForTests } from '../auth/refreshSession';
import { AddressFormContext, type AddressForm } from '../utils/addressForm';
import { AuthConfirmPage } from './AuthConfirmPage';

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { ok: true }));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// По умолчанию сессия этого браузера уже поднята (refresh по куке из редиректа).
function authValue(token: string | null = 'own-token', refreshed: string | null = null): AuthState {
  let current = token;
  return {
    accessToken: current,
    isLoading: false,
    isAuthenticated: !!current,
    authError: null,
    setAccessToken: vi.fn(),
    getAccessToken: () => current,
    logout: vi.fn(),
    refreshToken: vi.fn(() => {
      current = refreshed;
      return Promise.resolve(!!refreshed);
    }),
  };
}

function renderAt(path: string, form: AddressForm = 'ty', auth: AuthState = authValue()) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthContext.Provider value={auth}>
        <AddressFormContext.Provider value={{ form, setForm: vi.fn() }}>
          <Routes>
            <Route path="/auth/confirm" element={<AuthConfirmPage />} />
            <Route path="/today" element={<div>today-page</div>} />
          </Routes>
        </AddressFormContext.Provider>
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

const lastBody = () =>
  JSON.parse((fetchMock.mock.calls.at(-1)![1] as RequestInit).body as string);
const lastUrl = () => fetchMock.mock.calls.at(-1)![0] as string;
const lastAuthHeader = () =>
  ((fetchMock.mock.calls.at(-1)![1] as RequestInit).headers as Record<string, string>)
    .Authorization;

describe('AuthConfirmPage', () => {
  it('показывает код в сверяемом виде и обе кнопки', () => {
    renderAt('/auth/confirm?code=K7M2QX94');
    expect(screen.getByText('K7M2-QX94')).toBeTruthy();
    expect(screen.getByText(/впустить/i)).toBeTruthy();
    expect(screen.getByText('Это не я')).toBeTruthy();
    // Ничего не отправляем, пока человек не нажал.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('«Да» одобряет ИМЕННО этот код и уводит в приложение', async () => {
    renderAt('/auth/confirm?code=K7M2QX94');
    fireEvent.click(screen.getByText(/впустить/i));

    await waitFor(() => expect(screen.getByText('today-page')).toBeTruthy());
    expect(lastUrl()).toContain('/api/auth/ticket/confirm-login');
    expect(lastBody()).toEqual({ code: 'K7M2QX94' });
    expect(lastAuthHeader()).toBe('Bearer own-token');
  });

  it('сессия ещё не поднята — сначала refresh, подтверждение уходит с его токеном', async () => {
    const auth = authValue(null, 'fresh-token');
    renderAt('/auth/confirm?code=K7M2QX94', 'ty', auth);
    fireEvent.click(screen.getByText(/впустить/i));

    await waitFor(() => expect(screen.getByText('today-page')).toBeTruthy());
    expect(auth.refreshToken).toHaveBeenCalledTimes(1);
    expect(lastAuthHeader()).toBe('Bearer fresh-token');
  });

  it('сессии нет совсем — «код не найден», запрос без токена не уходит', async () => {
    renderAt('/auth/confirm?code=K7M2QX94', 'ty', authValue(null, null));
    fireEvent.click(screen.getByText(/впустить/i));

    await waitFor(() => expect(screen.getByText(/Код не найден/)).toBeTruthy());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('мёртвый/чужой код — честное «код не найден», без входа', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: false }));
    renderAt('/auth/confirm?code=ZZZZZZZZ');
    fireEvent.click(screen.getByText(/впустить/i));

    await waitFor(() => expect(screen.getByText(/Код не найден/)).toBeTruthy());
    expect(screen.queryByText('today-page')).toBeNull();
  });

  it('«Это не я» гасит билет и говорит, что доступ никто не получил', async () => {
    renderAt('/auth/confirm?code=K7M2QX94');
    fireEvent.click(screen.getByText('Это не я'));

    await waitFor(() =>
      expect(screen.getByText(/доступ никто не получил/i)).toBeTruthy(),
    );
    expect(lastUrl()).toContain('/api/auth/ticket/deny-login');
    expect(lastBody()).toEqual({ code: 'K7M2QX94' });
  });

  it('без кода на экране сверки делать нечего — уводит домой', async () => {
    renderAt('/auth/confirm');
    await waitFor(() => expect(screen.getByText('today-page')).toBeTruthy());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('форма «вы» — обращение без «ты»-строк', () => {
    const { container } = renderAt('/auth/confirm?code=K7M2QX94', 'vy');
    expect(container.textContent).toContain('вы открываете');
    expect(container.textContent).not.toMatch(/ты открываешь|нажми «Это не я»/);
  });
});

// Login-CSRF (аудит 2026-11): `/auth/confirm?code=X#access_token=<чужой>` раньше
// одобрял билет ЧУЖОЙ сессией из фрагмента. Теперь — только своей, из refresh.
describe('AuthConfirmPage — подброшенный #access_token не используется (регресс)', () => {
  beforeEach(() => resetRefreshLockForTests());
  afterEach(() => {
    resetRefreshLockForTests();
    window.history.replaceState(null, '', '/');
  });

  it('confirm-login уходит с токеном из refresh-куки, фрагмент стёрт', async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        String(url).endsWith('/api/auth/refresh')
          ? jsonResponse(200, { accessToken: 'mine', expiresIn: 900 })
          : jsonResponse(200, { ok: true }),
      ),
    );
    window.history.replaceState(null, '', '/auth/confirm?code=K7M2QX94#access_token=evil&expires_in=99999');
    render(
      <MemoryRouter initialEntries={['/auth/confirm?code=K7M2QX94']}>
        <AuthProvider>
          <AddressFormContext.Provider value={{ form: 'ty', setForm: vi.fn() }}>
            <Routes>
              <Route path="/auth/confirm" element={<AuthConfirmPage />} />
              <Route path="/today" element={<div>today-page</div>} />
            </Routes>
          </AddressFormContext.Provider>
        </AuthProvider>
      </MemoryRouter>,
    );
    expect(window.location.hash).toBe('');
    expect(window.location.search).toBe('?code=K7M2QX94');
    fireEvent.click(screen.getByText(/впустить/i));

    await waitFor(() => expect(screen.getByText('today-page')).toBeTruthy());
    expect(lastUrl()).toContain('/api/auth/ticket/confirm-login');
    expect(lastAuthHeader()).toBe('Bearer mine');
    const sentEvil = fetchMock.mock.calls.some((c) =>
      JSON.stringify((c[1] as RequestInit | undefined)?.headers ?? {}).includes('evil'),
    );
    expect(sentEvil).toBe(false);
  });
});

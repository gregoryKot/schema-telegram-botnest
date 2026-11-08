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

// Ответ сверки (login-preview) — форма контроллера src/auth/login-ticket/ticket-device.ts.
const PREVIEW = { deviceLabel: 'iPhone · Safari', createdAt: '2026-11-08T11:02:00.000Z' };
let previewReply: () => Response;

beforeEach(() => {
  previewReply = () => jsonResponse(200, PREVIEW);
  fetchMock = vi.fn((url: string) =>
    Promise.resolve(String(url).endsWith('/login-preview') ? previewReply() : jsonResponse(200, { ok: true })),
  );
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

const typeCode = (value: string) =>
  fireEvent.change(screen.getByLabelText('Код из приложения'), { target: { value } });
const confirmButton = () => screen.getByRole('button', { name: /впустить/i }) as HTMLButtonElement;
/** Набрать совпавший код и дождаться ответа сверки (кнопка оживает после него). */
async function typeMatching(value: string) {
  typeCode(value);
  await waitFor(() => expect(confirmButton().disabled).toBe(false));
}
const callsTo = (part: string) => fetchMock.mock.calls.filter((c) => String(c[0]).includes(part));

const lastBody = () =>
  JSON.parse((fetchMock.mock.calls.at(-1)![1] as RequestInit).body as string);
const lastUrl = () => fetchMock.mock.calls.at(-1)![0] as string;
const lastAuthHeader = () =>
  ((fetchMock.mock.calls.at(-1)![1] as RequestInit).headers as Record<string, string>)
    .Authorization;

describe('AuthConfirmPage', () => {
  // S9 (аудит 2026-11): ссылку с чужим кодом мог прислать кто угодно — код из
  // адреса не подставляется и не показывается, его набирают с экрана приложения.
  it('код из адреса не показан и не подставлен; кнопка «впустить» неактивна без ввода', () => {
    const { container } = renderAt('/auth/confirm?code=K7M2QX94');
    expect(container.textContent).not.toMatch(/K7M2/);
    expect((screen.getByLabelText('Код из приложения') as HTMLInputElement).value).toBe('');
    expect(confirmButton().disabled).toBe(true);
    expect(screen.getByText('Это не я')).toBeTruthy();
    fireEvent.click(confirmButton());
    // Ничего не отправляем, пока человек не набрал код и не нажал.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('чужой код — кнопка неактивна и подсказка «не совпадает»; совпавший (любой регистр, с дефисом) — активна', async () => {
    renderAt('/auth/confirm?code=K7M2QX94');
    typeCode('K7M2QX95');
    expect(confirmButton().disabled).toBe(true);
    expect(screen.getByText(/Код не совпадает/)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled(); // несовпавший код серверу не уходит
    await typeMatching('k7m2-qx94');
    expect(screen.queryByText(/Код не совпадает/)).toBeNull();
    expect((screen.getByLabelText('Код из приложения') as HTMLInputElement).value).toBe('K7M2-QX94');
  });

  it('«Да» одобряет ИМЕННО этот код и уводит в приложение', async () => {
    renderAt('/auth/confirm?code=K7M2QX94');
    await typeMatching('K7M2QX94');
    fireEvent.click(screen.getByText(/впустить/i));

    await waitFor(() => expect(screen.getByText('today-page')).toBeTruthy());
    expect(lastUrl()).toContain('/api/auth/ticket/confirm-login');
    expect(lastBody()).toEqual({ code: 'K7M2QX94' });
    expect(lastAuthHeader()).toBe('Bearer own-token');
  });

  it('сессия ещё не поднята — сначала refresh, подтверждение уходит с его токеном', async () => {
    const auth = authValue(null, 'fresh-token');
    renderAt('/auth/confirm?code=K7M2QX94', 'ty', auth);
    await typeMatching('K7M2QX94');
    fireEvent.click(screen.getByText(/впустить/i));

    await waitFor(() => expect(screen.getByText('today-page')).toBeTruthy());
    expect(auth.refreshToken).toHaveBeenCalledTimes(1);
    expect(lastAuthHeader()).toBe('Bearer fresh-token');
  });

  it('сессии нет совсем — «код не найден», запрос без токена не уходит', async () => {
    renderAt('/auth/confirm?code=K7M2QX94', 'ty', authValue(null, null));
    await typeMatching('K7M2QX94');
    fireEvent.click(screen.getByText(/впустить/i));

    await waitFor(() => expect(screen.getByText(/Код не найден/)).toBeTruthy());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('сверка ответила 404 (код мёртв) — «код не найден» сразу, подтверждать нечего', async () => {
    previewReply = () => jsonResponse(404, { message: 'Not Found' });
    renderAt('/auth/confirm?code=ZZZZZZZZ');
    typeCode('ZZZZZZZZ');
    await waitFor(() => expect(screen.getByText(/Код не найден/)).toBeTruthy());
    expect(callsTo('/confirm-login')).toHaveLength(0);
  });

  it('мёртвый/чужой код — честное «код не найден», без входа', async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(String(url).endsWith('/login-preview') ? previewReply() : jsonResponse(200, { ok: false })));
    renderAt('/auth/confirm?code=ZZZZZZZZ');
    await typeMatching('ZZZZZZZZ');
    fireEvent.click(screen.getByText(/впустить/i));

    await waitFor(() => expect(screen.getByText(/Код не найден/)).toBeTruthy());
    expect(screen.queryByText('today-page')).toBeNull();
    // Не тупик: из исхода есть путь в приложение.
    fireEvent.click(screen.getByRole('link', { name: 'В приложение' }));
    await waitFor(() => expect(screen.getByText('today-page')).toBeTruthy());
  });

  it('«Это не я» гасит билет и говорит, что доступ никто не получил', async () => {
    renderAt('/auth/confirm?code=K7M2QX94');
    fireEvent.click(screen.getByText('Это не я'));

    await waitFor(() =>
      expect(screen.getByText(/доступ никто не получил/i)).toBeTruthy(),
    );
    expect(lastUrl()).toContain('/api/auth/ticket/deny-login');
    expect(lastBody()).toEqual({ code: 'K7M2QX94' });
    fireEvent.click(screen.getByRole('link', { name: 'В приложение' }));
    await waitFor(() => expect(screen.getByText('today-page')).toBeTruthy());
  });

  it('без кода на экране сверки делать нечего — уводит домой', async () => {
    renderAt('/auth/confirm');
    await waitFor(() => expect(screen.getByText('today-page')).toBeTruthy());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('форма «вы» — обращение без «ты»-строк', () => {
    const { container } = renderAt('/auth/confirm?code=K7M2QX94', 'vy');
    expect(container.textContent).toContain('вы открываете');
    expect(container.textContent).not.toMatch(/ты открываешь|нажми «Это не я»|Набери /);
    fireEvent.change(screen.getByLabelText('Код из приложения'), { target: { value: 'AAAAAAAA' } });
    expect(container.textContent).toContain('Сверьте его');
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
    await typeMatching('K7M2QX94');
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

// S9 (аудит 2026-11): после совпадения набранного кода экран показывает,
// какое устройство и когда просило вход (login-preview), — время в зоне
// читателя. Спрашиваем по НАБРАННОМУ коду и только после совпадения.
describe('AuthConfirmPage — устройство и время запроса', () => {
  it('«Устройство: iPhone · Safari, запрошено в 14:02» (Москва) — по набранному коду, с Bearer', async () => {
    await withTimeZoneAsync('Europe/Moscow', async () => {
      renderAt('/auth/confirm?code=K7M2QX94');
      expect(screen.queryByText(/Устройство:/)).toBeNull();
      await typeMatching('k7m2-qx94');
      const line = await screen.findByText(/Устройство:/);
      expect(line.textContent).toBe('Устройство: iPhone · Safari, запрошено в 14:02');
      const [url, init] = callsTo('/login-preview')[0] as [string, RequestInit];
      expect(url).toContain('/api/auth/ticket/login-preview');
      expect(JSON.parse(init.body as string)).toEqual({ code: 'K7M2QX94' });
      expect((init.headers as Record<string, string>).Authorization).toBe('Bearer own-token');
      expect((init.headers as Record<string, string>)['x-requested-with']).toBe('webapp');
    });
  });

  it('устройство не определилось — так и сказано, без выдумки', async () => {
    previewReply = () => jsonResponse(200, { deviceLabel: null, createdAt: PREVIEW.createdAt });
    renderAt('/auth/confirm?code=K7M2QX94');
    await typeMatching('K7M2QX94');
    expect((await screen.findByText(/Устройство:/)).textContent).toMatch(/^Устройство: не определилось, запрошено в \d\d:\d\d$/);
  });

  it('сверка недоступна (500) — подтверждать можно, подписи устройства нет', async () => {
    previewReply = () => jsonResponse(500, {});
    renderAt('/auth/confirm?code=K7M2QX94');
    await typeMatching('K7M2QX94');
    expect(screen.queryByText(/Устройство:/)).toBeNull();
  });
});

async function withTimeZoneAsync(tz: string, fn: () => Promise<void>) {
  const previous = process.env.TZ;
  process.env.TZ = tz;
  try { await fn(); } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
}

// @vitest-environment jsdom
// Компонентные тесты AccountPage — контур, где данные реально сливаются
// между аккаунтами (привязка/отвязка провайдеров, email-линковка). Мокаем
// global fetch (компонент ходит напрямую через fetch, не через '../api') —
// образец подмены: AuthCallback.test.tsx (сайт), SettingsSheet.test.tsx
// (мок API-слоя). AuthContext подставляем напрямую, не через AuthProvider —
// AuthProvider сам делает refresh-fetch на маунте, что зашумило бы мок.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext, type AuthState } from '../auth/authContext';
import { AccountPage } from './AccountPage';

interface Provider {
  provider: 'google' | 'telegram' | 'vk' | 'email';
  email: string | null;
  displayName: string | null;
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;
let meProviders: Provider[];
let meFails: boolean;

function routeFetch(url: string, init?: RequestInit): Promise<Response> {
  const method = init?.method ?? 'GET';
  if (url.includes('/api/auth/me')) {
    if (meFails) return Promise.resolve(jsonResponse(500, {}));
    return Promise.resolve(jsonResponse(200, { providers: meProviders, totp: { enabled: false, recoveryCodesLeft: 0 } }));
  }
  if (url.includes('/api/therapy/request')) {
    return Promise.resolve(jsonResponse(200, null));
  }
  if (url.includes('/api/auth/unlink/') && method === 'POST') {
    return Promise.resolve(jsonResponse(200, {}));
  }
  if (url.includes('/api/auth/email/link-to-account') && method === 'POST') {
    return Promise.resolve(jsonResponse(200, {}));
  }
  return Promise.resolve(jsonResponse(404, { message: 'not mocked: ' + url }));
}

function authValue(overrides: Partial<AuthState> = {}): AuthState {
  return {
    accessToken: 'tok123',
    isLoading: false,
    isAuthenticated: true,
    setAccessToken: vi.fn(),
    logout: vi.fn().mockResolvedValue(undefined),
    refreshToken: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

beforeEach(() => {
  meProviders = [];
  meFails = false;
  fetchMock = vi.fn((url: string, init?: RequestInit) => routeFetch(url, init));
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('confirm', vi.fn(() => true));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderPage(auth: AuthState = authValue()) {
  return render(
    <MemoryRouter initialEntries={['/account']}>
      <AuthContext.Provider value={auth}>
        <AccountPage />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

describe('AccountPage — загрузка', () => {
  it('показывает спиннер, пока /api/auth/me не ответил', async () => {
    let resolveMe!: (v: Response) => void;
    fetchMock = vi.fn((url: string) => {
      if (url.includes('/api/auth/me')) return new Promise<Response>(r => { resolveMe = r; });
      return routeFetch(url);
    });
    vi.stubGlobal('fetch', fetchMock);

    const { container } = renderPage();
    expect(container.querySelector('.spinner')).toBeTruthy();

    await act(async () => { resolveMe(jsonResponse(200, { providers: [], totp: { enabled: false, recoveryCodesLeft: 0 } })); });
    await waitFor(() => expect(container.querySelector('.spinner')).toBeNull());
  });

  it('на чистом аккаунте (providers: []) все методы входа показаны как непривязанные — без выдуманных данных', async () => {
    renderPage();
    await screen.findByText('Аккаунт');

    // Все 4 кнопки "Привязать" (google, telegram, vk, email), ни одной "Отвязать".
    expect(screen.getAllByText('Привязать').length).toBe(4);
    expect(screen.queryByText('Отвязать')).toBeNull();
    expect(screen.getByText('не привязан')).toBeTruthy();
  });

  it('ошибка /api/auth/me показывает сообщение об ошибке, а не тишину', async () => {
    meFails = true;
    renderPage();

    await waitFor(() => expect(screen.getByText(/Failed to load account/)).toBeTruthy());
  });
});

describe('AccountPage — реальные данные провайдеров', () => {
  it('привязанный Google показывает email и кнопку «Отвязать», а не заглушку', async () => {
    meProviders = [{ provider: 'google', email: 'user@gmail.com', displayName: null }];
    renderPage();
    await screen.findByText('Аккаунт');

    expect(screen.getByText('user@gmail.com')).toBeTruthy();
    expect(screen.getByText('Отвязать')).toBeTruthy();
  });

  it('привязанный VK и Telegram показывают displayName из api, а не общий "привязан" при его наличии', async () => {
    meProviders = [
      { provider: 'vk', email: null, displayName: 'Пётр ВК' },
      { provider: 'telegram', email: null, displayName: '@petya' },
    ];
    renderPage();
    await screen.findByText('Аккаунт');

    expect(screen.getByText('Пётр ВК')).toBeTruthy();
    expect(screen.getByText('@petya')).toBeTruthy();
  });

  it('успешная отвязка VK вызывает POST /api/auth/unlink/vk', async () => {
    meProviders = [{ provider: 'vk', email: null, displayName: null }];
    renderPage();
    await screen.findByText('привязан');
    fireEvent.click(screen.getByText('Отвязать'));
    meProviders = [];

    await waitFor(() => expect(screen.queryByText('Отвязать')).toBeNull());
    expect(fetchMock.mock.calls.some(([url]: [string]) => url.includes('/api/auth/unlink/vk'))).toBe(true);
  });
});

describe('AccountPage — отвязка провайдера', () => {
  it('успешная отвязка вызывает POST /api/auth/unlink/:provider и обновляет список через refresh', async () => {
    meProviders = [{ provider: 'google', email: 'user@gmail.com', displayName: null }];
    renderPage();
    await screen.findByText('Отвязать');

    // После unlink следующий /api/auth/me должен вернуть пустой список.
    fireEvent.click(screen.getByText('Отвязать'));
    meProviders = [];

    await waitFor(() => expect(screen.queryByText('Отвязать')).toBeNull());
    const unlinkCall = fetchMock.mock.calls.find(([url]: [string]) => url.includes('/api/auth/unlink/google'));
    expect(unlinkCall).toBeTruthy();
    expect(unlinkCall![1]).toMatchObject({ method: 'POST' });
    expect((unlinkCall![1].headers as Record<string, string>).Authorization).toBe('Bearer tok123');
  });

  it('отказ подтверждения (confirm=false) не вызывает api', async () => {
    vi.stubGlobal('confirm', vi.fn(() => false));
    meProviders = [{ provider: 'google', email: 'user@gmail.com', displayName: null }];
    renderPage();
    await screen.findByText('Отвязать');

    fireEvent.click(screen.getByText('Отвязать'));
    await act(async () => {});

    expect(fetchMock.mock.calls.some(([url]: [string]) => url.includes('/api/auth/unlink/'))).toBe(false);
  });

  it('ошибка API при отвязке показывает причину и оставляет провайдер привязанным', async () => {
    meProviders = [{ provider: 'google', email: 'user@gmail.com', displayName: null }];
    fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url.includes('/api/auth/unlink/')) return Promise.resolve(jsonResponse(400, { message: 'Нельзя отвязать последний способ входа' }));
      return routeFetch(url, init);
    });
    vi.stubGlobal('fetch', fetchMock);

    renderPage();
    await screen.findByText('Отвязать');
    fireEvent.click(screen.getByText('Отвязать'));

    await screen.findByText(/Нельзя отвязать последний способ входа/);
    // Провайдер остался привязанным — отвязка не «тихо прошла».
    expect(screen.getByText('user@gmail.com')).toBeTruthy();
    expect(screen.getByText('Отвязать')).toBeTruthy();
  });
});

describe('AccountPage — привязка email', () => {
  it('успешная отправка вызывает POST с введённым email и показывает подтверждение', async () => {
    renderPage();
    await screen.findByText('не привязан');

    fireEvent.click(screen.getAllByText('Привязать').slice(-1)[0]); // кнопка email — последняя в разметке
    const input = screen.getByPlaceholderText('your@email.com');
    fireEvent.change(input, { target: { value: 'me@example.com' } });
    fireEvent.click(screen.getByText('Отправить'));

    await screen.findByText(/Письмо отправлено на/);
    expect(screen.getByText('me@example.com')).toBeTruthy();

    const linkCall = fetchMock.mock.calls.find(([url]: [string]) => url.includes('/api/auth/email/link-to-account'));
    expect(linkCall).toBeTruthy();
    expect(JSON.parse(linkCall![1].body as string)).toEqual({ email: 'me@example.com' });
  });

  it('ошибка API при привязке email показывает сообщение и не переходит в состояние "отправлено"', async () => {
    fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url.includes('/api/auth/email/link-to-account')) return Promise.resolve(jsonResponse(409, { message: 'Email уже занят' }));
      return routeFetch(url, init);
    });
    vi.stubGlobal('fetch', fetchMock);

    renderPage();
    await screen.findByText('не привязан');

    fireEvent.click(screen.getAllByText('Привязать').slice(-1)[0]);
    fireEvent.change(screen.getByPlaceholderText('your@email.com'), { target: { value: 'taken@example.com' } });
    fireEvent.click(screen.getByText('Отправить'));

    await screen.findByText(/Email уже занят/);
    expect(screen.queryByText(/Письмо отправлено на/)).toBeNull();
  });
});

describe('AccountPage — выход', () => {
  it('кнопка «Выйти» вызывает logout()', async () => {
    const logout = vi.fn().mockResolvedValue(undefined);
    renderPage(authValue({ logout }));
    await screen.findByText('Аккаунт');

    fireEvent.click(screen.getByText('Выйти'));

    expect(logout).toHaveBeenCalledTimes(1);
  });
});

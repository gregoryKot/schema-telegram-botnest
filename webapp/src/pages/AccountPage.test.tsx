// @vitest-environment jsdom
// Компонентные тесты AccountPage — контур, где данные реально сливаются
// между аккаунтами (привязка/отвязка провайдеров, email-линковка). Мокаем
// global fetch (компонент ходит напрямую через fetch, не через '../api') —
// образец подмены: AuthCallback.test.tsx (сайт), SettingsSheet.test.tsx
// (мок API-слоя). AuthContext подставляем напрямую, не через AuthProvider —
// AuthProvider сам делает refresh-fetch на маунте, что зашумило бы мок.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  within,
  fireEvent,
  cleanup,
  waitFor,
  act,
} from '@testing-library/react';
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
    return Promise.resolve(
      jsonResponse(200, {
        providers: meProviders,
        totp: { enabled: false, recoveryCodesLeft: 0 },
      }),
    );
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
  if (url.includes('/api/auth/link-token')) {
    return Promise.resolve(jsonResponse(200, {}));
  }
  // Билет привязки: карточка объединения выписывает его при показе (сама
  // карточка — AccountLinkSection.test.tsx, тут проверяем только видимость).
  if (url.includes('/api/auth/ticket/start')) {
    return Promise.resolve(
      jsonResponse(200, {
        deviceCode: 'device-secret',
        userCode: 'ABCD2345',
        expiresIn: 600,
        interval: 5,
      }),
    );
  }
  if (url.includes('/api/event')) {
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
});

// Ж4 (аудит 2026-08): нативный window.confirm() заменён на ConfirmDialog —
// клик по «Отвязать» в строке провайдера открывает диалог, подтверждение
// нажимается отдельно на его собственной кнопке «Отвязать» (в этот момент
// на экране их две — строка и диалог, различаем через within(dialog)).
function confirmUnlink() {
  const dialog = screen.getByRole('dialog');
  fireEvent.click(within(dialog).getByText('Отвязать'));
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderPage(auth: AuthState = authValue(), url = '/account') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <AuthContext.Provider value={auth}>
        <AccountPage />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

describe('AccountPage — загрузка', () => {
  it('пока /api/auth/me не ответил — силуэт будущих строк входа, а не спиннер', async () => {
    let resolveMe!: (v: Response) => void;
    fetchMock = vi.fn((url: string) => {
      if (url.includes('/api/auth/me'))
        return new Promise<Response>((r) => {
          resolveMe = r;
        });
      return routeFetch(url);
    });
    vi.stubGlobal('fetch', fetchMock);

    const { container } = renderPage();
    expect(container.querySelectorAll('.skel').length).toBeGreaterThan(0);
    expect(container.querySelector('.spinner')).toBeNull();

    await act(async () => {
      resolveMe(
        jsonResponse(200, {
          providers: [],
          totp: { enabled: false, recoveryCodesLeft: 0 },
        }),
      );
    });
    await waitFor(() => expect(container.querySelector('.skel')).toBeNull());
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

    await waitFor(() =>
      expect(screen.getByText(/Failed to load account/)).toBeTruthy(),
    );
  });
});

describe('AccountPage — реальные данные провайдеров', () => {
  it('привязанный Google показывает email и кнопку «Отвязать», а не заглушку', async () => {
    meProviders = [
      { provider: 'google', email: 'user@gmail.com', displayName: null },
    ];
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
    confirmUnlink();
    meProviders = [];

    await waitFor(() => expect(screen.queryByText('Отвязать')).toBeNull());
    expect(
      fetchMock.mock.calls.some(([url]: [string]) =>
        url.includes('/api/auth/unlink/vk'),
      ),
    ).toBe(true);
  });
});

describe('AccountPage — отвязка провайдера', () => {
  it('клик по «Отвязать» открывает диалог подтверждения (не бьёт по api сразу)', async () => {
    meProviders = [
      { provider: 'google', email: 'user@gmail.com', displayName: null },
    ];
    renderPage();
    await screen.findByText('Отвязать');

    fireEvent.click(screen.getByText('Отвязать'));
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(within(dialog).getByText('Отвязать Google?')).toBeTruthy();
    expect(
      fetchMock.mock.calls.some(([url]: [string]) =>
        url.includes('/api/auth/unlink/'),
      ),
    ).toBe(false);
  });

  it('успешная отвязка вызывает POST /api/auth/unlink/:provider и обновляет список через refresh', async () => {
    meProviders = [
      { provider: 'google', email: 'user@gmail.com', displayName: null },
    ];
    renderPage();
    await screen.findByText('Отвязать');

    fireEvent.click(screen.getByText('Отвязать'));
    confirmUnlink();
    // После unlink следующий /api/auth/me должен вернуть пустой список.
    meProviders = [];

    await waitFor(() => expect(screen.queryByText('Отвязать')).toBeNull());
    const unlinkCall = fetchMock.mock.calls.find(([url]: [string]) =>
      url.includes('/api/auth/unlink/google'),
    );
    expect(unlinkCall).toBeTruthy();
    expect(unlinkCall![1]).toMatchObject({ method: 'POST' });
    expect(
      (unlinkCall![1].headers as Record<string, string>).Authorization,
    ).toBe('Bearer tok123');
  });

  it('отмена в диалоге не вызывает api', async () => {
    meProviders = [
      { provider: 'google', email: 'user@gmail.com', displayName: null },
    ];
    renderPage();
    await screen.findByText('Отвязать');

    fireEvent.click(screen.getByText('Отвязать'));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByText('Отмена'));
    await act(async () => {});

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(
      fetchMock.mock.calls.some(([url]: [string]) =>
        url.includes('/api/auth/unlink/'),
      ),
    ).toBe(false);
  });

  it('Escape в диалоге закрывает его без вызова api', async () => {
    meProviders = [
      { provider: 'google', email: 'user@gmail.com', displayName: null },
    ];
    renderPage();
    await screen.findByText('Отвязать');

    fireEvent.click(screen.getByText('Отвязать'));
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(
      fetchMock.mock.calls.some(([url]: [string]) =>
        url.includes('/api/auth/unlink/'),
      ),
    ).toBe(false);
  });

  it('ошибка API при отвязке показывает причину и оставляет провайдер привязанным', async () => {
    meProviders = [
      { provider: 'google', email: 'user@gmail.com', displayName: null },
    ];
    fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url.includes('/api/auth/unlink/'))
        return Promise.resolve(
          jsonResponse(400, {
            message: 'Нельзя отвязать последний способ входа',
          }),
        );
      return routeFetch(url, init);
    });
    vi.stubGlobal('fetch', fetchMock);

    renderPage();
    await screen.findByText('Отвязать');
    fireEvent.click(screen.getByText('Отвязать'));
    confirmUnlink();

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

    const linkCall = fetchMock.mock.calls.find(([url]: [string]) =>
      url.includes('/api/auth/email/link-to-account'),
    );
    expect(linkCall).toBeTruthy();
    expect(JSON.parse(linkCall![1].body as string)).toEqual({
      email: 'me@example.com',
    });
  });

  it('ошибка API при привязке email показывает сообщение и не переходит в состояние "отправлено"', async () => {
    fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url.includes('/api/auth/email/link-to-account'))
        return Promise.resolve(
          jsonResponse(409, { message: 'Email уже занят' }),
        );
      return routeFetch(url, init);
    });
    vi.stubGlobal('fetch', fetchMock);

    renderPage();
    await screen.findByText('не привязан');

    fireEvent.click(screen.getAllByText('Привязать').slice(-1)[0]);
    fireEvent.change(screen.getByPlaceholderText('your@email.com'), {
      target: { value: 'taken@example.com' },
    });
    fireEvent.click(screen.getByText('Отправить'));

    await screen.findByText(/Email уже занят/);
    expect(screen.queryByText(/Письмо отправлено на/)).toBeNull();
  });
});

// П5 (симптом 2026-08-21): linkGoogle/linkVk запрашивают link-token ПЕРЕД
// редиректом — без этой httpOnly-куки сервер не видит текущего пользователя,
// и вместо привязки создаётся/логинится ДРУГОЙ аккаунт. linkTelegram этого
// не делал — здесь регрессионный тест на то, что теперь делает, как соседи.
describe('AccountPage — привязка Telegram', () => {
  it('перед редиректом на /api/auth/telegram/redirect запрашивает link-token (как linkGoogle/linkVk)', async () => {
    const originalHref = window.location.href;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, href: '' },
    });
    try {
      renderPage();
      await screen.findByText('Аккаунт');

      // Кнопки «Привязать» в порядке разметки: Google, Telegram, VK, Email.
      fireEvent.click(screen.getAllByText('Привязать')[1]);

      await waitFor(() =>
        expect(
          fetchMock.mock.calls.some(([url]: [string]) =>
            String(url).includes('/api/auth/link-token'),
          ),
        ).toBe(true),
      );
      expect(window.location.href).toContain('/api/auth/telegram/redirect');
    } finally {
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: { ...window.location, href: originalHref },
      });
    }
  });
});

// Перенос данных из бота/мини-аппа: карточка живёт в AccountLinkSection
// (её собственные тесты рядом с ней), страница отвечает за две вещи —
// показать её тому, у кого второй аккаунт РЕАЛЬНО есть, и не показывать
// остальным.
describe('AccountPage — карточка объединения аккаунтов', () => {
  it('вход только через Google — карточка предлагает подключить Telegram', async () => {
    meProviders = [
      { provider: 'google', email: 'user@gmail.com', displayName: null },
    ];
    renderPage();

    await screen.findByText('Данные из Telegram');
    const link = screen.getByText('Подключить Telegram');
    expect(link.getAttribute('href')).toContain('?start=link_ABCD2345');
  });

  it('Telegram уже привязан — карточки нет и билет не выписывается', async () => {
    meProviders = [
      { provider: 'google', email: 'user@gmail.com', displayName: null },
      { provider: 'telegram', email: null, displayName: '@petya' },
    ];
    renderPage();
    await screen.findByText('Аккаунт');

    await waitFor(() =>
      expect(screen.queryByText('Данные из Telegram')).toBeNull(),
    );
    expect(
      fetchMock.mock.calls.some(([url]: [string]) =>
        String(url).includes('/api/auth/ticket/start'),
      ),
    ).toBe(false);
  });
});

// Ссылка из письма на занятый адрес: сервер уводит сюда с ?error=email_taken
// вместо прежнего «ссылка истекла» — неправды, из-за которой человек шёл
// запрашивать письмо заново и получал тот же результат.
describe('AccountPage — занятый email', () => {
  it('?error=email_taken называет причину и не врёт про истёкшую ссылку', async () => {
    renderPage(authValue(), '/account?error=email_taken');
    await screen.findByText('Аккаунт');

    expect(screen.getByText(/уже привязан к другому аккаунту/)).toBeTruthy();
    expect(screen.queryByText(/истекла|истёк/)).toBeNull();
  });

  it('без параметра ошибки блок ошибки не показывается', async () => {
    renderPage();
    await screen.findByText('Аккаунт');

    expect(screen.queryByText(/уже привязан к другому аккаунту/)).toBeNull();
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

  it('«Выйти со всех устройств» открывает подтверждение и НЕ логаутит сразу', async () => {
    const logout = vi.fn().mockResolvedValue(undefined);
    renderPage(authValue({ logout }));
    await screen.findByText('Аккаунт');

    fireEvent.click(screen.getByText('Выйти со всех устройств'));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Выйти со всех устройств?')).toBeTruthy();
    expect(logout).not.toHaveBeenCalled();
  });

  it('подтверждение «Выйти везде» вызывает logout(true) — все сессии', async () => {
    const logout = vi.fn().mockResolvedValue(undefined);
    renderPage(authValue({ logout }));
    await screen.findByText('Аккаунт');

    fireEvent.click(screen.getByText('Выйти со всех устройств'));
    fireEvent.click(
      within(screen.getByRole('dialog')).getByText('Выйти везде'),
    );

    expect(logout).toHaveBeenCalledWith(true);
  });

  it('отмена в диалоге не логаутит', async () => {
    const logout = vi.fn().mockResolvedValue(undefined);
    renderPage(authValue({ logout }));
    await screen.findByText('Аккаунт');

    fireEvent.click(screen.getByText('Выйти со всех устройств'));
    fireEvent.click(within(screen.getByRole('dialog')).getByText('Отмена'));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(logout).not.toHaveBeenCalled();
  });
});

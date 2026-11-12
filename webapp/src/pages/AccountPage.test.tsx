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
import { MemoryRouter, Route, Routes, useNavigate, type NavigateFunction } from 'react-router-dom';
import { useEffect } from 'react';
import { AuthContext, type AuthState } from '../auth/authContext';
import { THERAPIST_MODE_KEY } from '../utils/storageKeys';
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
// «Отвязать» у способа входа по названию строки: у единственного способа
// кнопка недоступна (QA 2026-11, М2), поэтому в тестах отвязки их два.
function unlinkBtn(title: string): HTMLElement {
  const row = screen.getByText(title).closest('.aa-row') as HTMLElement;
  return within(row).getByText('Отвязать');
}

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

    // Обе кнопки "Привязать" (vk, email), ни одной "Отвязать". Google и
    // Telegram без привязки не показаны вовсе: входа через них на сайте нет (2026-11).
    expect(screen.getAllByText('Привязать').length).toBe(2);
    expect(screen.queryByText('Google')).toBeNull();
    expect(screen.queryByText('Telegram')).toBeNull();
    expect(screen.queryByText('Отвязать')).toBeNull();
    expect(screen.getByText('не привязан')).toBeTruthy();
  });

  it('заголовок способов входа считает реальные привязки: «N из M»', async () => {
    renderPage();
    await screen.findByText('0 из 2');
    cleanup();
    meProviders = [{ provider: 'google', email: 'user@gmail.com', displayName: null }];
    renderPage();
    await screen.findByText('1 из 3'); // прежняя привязка Google — своя строка
    expect(screen.getByText('U')).toBeTruthy();
  });

  // Аудит 2026-10, «сырой текст на экранах аккаунта»: раньше здесь стояли
  // «Error: Failed to load account» и «TypeError: Failed to fetch».
  it('500 от /api/auth/me — человеческий текст об ошибке, а не тишина и не «Failed to load account»', async () => {
    meFails = true;
    const { container } = renderPage();

    await screen.findByText('Сервер не ответил. Повторить можно чуть позже');
    expect(container.textContent).not.toMatch(/Failed|Error/);
  });

  it('обрыв сети на /api/auth/me — «Нет связи с сервером», не «TypeError: Failed to fetch»', async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) =>
      url.includes('/api/auth/me') ? Promise.reject(new TypeError('Failed to fetch')) : routeFetch(url, init));
    const { container } = renderPage();

    await screen.findByText('Нет связи с сервером');
    expect(container.textContent).not.toMatch(/TypeError|Failed to fetch/);
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
    meProviders = [
      { provider: 'vk', email: null, displayName: null },
      { provider: 'telegram', email: null, displayName: '@petya' },
    ];
    renderPage();
    await screen.findByText('привязан');
    fireEvent.click(unlinkBtn('ВКонтакте'));
    confirmUnlink();
    meProviders = [{ provider: 'telegram', email: null, displayName: '@petya' }];

    await waitFor(() => expect(screen.queryByText('@petya')).toBeTruthy());
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
      { provider: 'telegram', email: null, displayName: '@petya' },
    ];
    renderPage();
    await screen.findAllByText('Отвязать');

    fireEvent.click(unlinkBtn('Google'));
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
      { provider: 'telegram', email: null, displayName: '@petya' },
    ];
    renderPage();
    await screen.findAllByText('Отвязать');

    fireEvent.click(unlinkBtn('Google'));
    confirmUnlink();
    // После unlink следующий /api/auth/me вернёт только Telegram.
    meProviders = [{ provider: 'telegram', email: null, displayName: '@petya' }];

    await waitFor(() => expect(screen.queryByText('user@gmail.com')).toBeNull());
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
      { provider: 'telegram', email: null, displayName: '@petya' },
    ];
    renderPage();
    await screen.findAllByText('Отвязать');

    fireEvent.click(unlinkBtn('Google'));
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
      { provider: 'telegram', email: null, displayName: '@petya' },
    ];
    renderPage();
    await screen.findAllByText('Отвязать');

    fireEvent.click(unlinkBtn('Google'));
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(
      fetchMock.mock.calls.some(([url]: [string]) =>
        url.includes('/api/auth/unlink/'),
      ),
    ).toBe(false);
  });

  // Подтверждение держит свою запись истории (HistoryConfirmDialog): «Назад» браузера
  // закрывает его, а не уводит со страницы аккаунта.
  it('«Назад» браузера закрывает диалог отвязки и остаётся на странице', async () => {
    meProviders = [
      { provider: 'google', email: 'user@gmail.com', displayName: null },
      { provider: 'telegram', email: null, displayName: '@petya' },
    ];
    const snap = { nav: null as NavigateFunction | null };
    function NavSpy() {
      const nav = useNavigate();
      useEffect(() => { snap.nav = nav; });
      return null;
    }
    render(
      <MemoryRouter initialEntries={['/today', '/account']} initialIndex={1}>
        <NavSpy />
        <AuthContext.Provider value={authValue()}>
          <Routes>
            <Route path="/today" element={<div>сегодня</div>} />
            <Route path="/account" element={<AccountPage />} />
          </Routes>
        </AuthContext.Provider>
      </MemoryRouter>,
    );
    await screen.findAllByText('Отвязать');
    fireEvent.click(unlinkBtn('Google'));
    expect(screen.getByRole('dialog')).toBeTruthy();
    await act(async () => {});
    await act(async () => { snap.nav!(-1); });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.queryByText('сегодня')).toBeNull();
    expect(screen.getByText('user@gmail.com')).toBeTruthy();
    expect(fetchMock.mock.calls.some(([url]: [string]) => url.includes('/api/auth/unlink/'))).toBe(false);
  });

  it('ошибка API при отвязке показывает причину и оставляет провайдер привязанным', async () => {
    meProviders = [
      { provider: 'google', email: 'user@gmail.com', displayName: null },
      { provider: 'telegram', email: null, displayName: '@petya' },
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
    await screen.findAllByText('Отвязать');
    fireEvent.click(unlinkBtn('Google'));
    confirmUnlink();

    await screen.findByText(/Нельзя отвязать последний способ входа/);
    // Провайдер остался привязанным — отвязка не «тихо прошла».
    expect(screen.getByText('user@gmail.com')).toBeTruthy();
    expect(unlinkBtn('Google')).toBeTruthy();
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

    await screen.findByText(/письмо придёт в течение минуты/);
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
    expect(screen.queryByText(/письмо придёт в течение минуты/)).toBeNull();
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

// Управления подпиской по сессии нет: экран управления открывается только по
// ?token=… из ссылки после оплаты (docs/open/backend.md). Строка ведёт на
// /subscribe — форму оформления — и управление не обещает (FIX_PLAN 4.10).
describe('AccountPage — строка «Подписка»', () => {
  it('ведёт на /subscribe без обещания «Управлять»', async () => {
    renderPage();
    await screen.findByText('Аккаунт');

    const row = screen.getByText('Подписка').closest('a') as HTMLAnchorElement;
    expect(row.getAttribute('href')).toBe('/subscribe');
    expect(row.textContent).toContain('Регулярная поддержка проекта');
    expect(row.textContent).not.toMatch(/Управлять/);
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

// #902: терапевт с телефона приходит сюда из кабинета (лист настроек → «Аккаунт и
// способы входа»). «← Назад» возвращает в дом режима: клиентское «Сегодня» для
// него — лишний прыжок, бутстрап сразу вернул бы его в кабинет.
describe('AccountPage — «← Назад» ведёт в дом текущего режима', () => {
  afterEach(() => localStorage.removeItem(THERAPIST_MODE_KEY));

  async function renderWithHomes() {
    render(
      <MemoryRouter initialEntries={['/account']}>
        <AuthContext.Provider value={authValue()}>
          <Routes>
            <Route path="/account" element={<AccountPage />} />
            <Route path="/cabinet" element={<div>дом кабинета</div>} />
            <Route path="/today" element={<div>дом клиента</div>} />
          </Routes>
        </AuthContext.Provider>
      </MemoryRouter>,
    );
    await screen.findByText('Аккаунт');
  }

  it('режим терапевта (therapist_mode=1) — в /cabinet', async () => {
    localStorage.setItem(THERAPIST_MODE_KEY, '1');
    await renderWithHomes();
    fireEvent.click(screen.getByRole('button', { name: 'Назад' }));
    expect(await screen.findByText('дом кабинета')).toBeTruthy();
    expect(screen.queryByText('дом клиента')).toBeNull();
  });

  it.each([['0'], [null]])('режим клиента (therapist_mode=%s) — в /today', async (flag) => {
    if (flag !== null) localStorage.setItem(THERAPIST_MODE_KEY, flag);
    await renderWithHomes();
    fireEvent.click(screen.getByRole('button', { name: 'Назад' }));
    expect(await screen.findByText('дом клиента')).toBeTruthy();
    expect(screen.queryByText('дом кабинета')).toBeNull();
  });
});

// #906: шапка страницы — общая ds-sheet-head/ds-back, заголовок — eyebrow «Аккаунт»
// над ds-h1, своих .aa-back/.aa-h1 нет; «Выйти со всех устройств» — ds-link.
describe('AccountPage — шапка и заголовок (#906)', () => {
  it('«← Назад» — ds-back внутри ds-sheet-head; eyebrow «Аккаунт» над ds-h1', async () => {
    renderPage();
    await screen.findByText('Аккаунт');
    const back = screen.getByRole('button', { name: 'Назад' });
    expect(back.className).toBe('ds-back');
    expect(back.parentElement!.className).toBe('ds-sheet-head ds-sheet-head--page');
    expect(screen.getByText('Аккаунт').className).toBe('ds-eyebrow');
    expect(screen.getByRole('heading', { level: 1 }).classList.contains('ds-h1')).toBe(true);
    expect(document.querySelector('.aa-lead')!.className).toBe('ds-sub aa-lead'); // подзаголовок как в main, общего ds-lead нет
    expect(screen.getByText('Выйти со всех устройств').className).toBe('ds-link');
  });
});

// b27: группа 2FA — силуэт только до первой загрузки. Включение 2FA перечитывает /api/auth/me;
// силуэт на каждый refresh размонтировал бы секцию вместе с только что выданными резервными
// кодами (стенд pages-account-2fa-codes — коды не появлялись).
describe('AccountPage — включение 2FA', () => {
  it('после включения резервные коды видны, хотя страница перечитала способы входа', async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes('/api/auth/2fa/setup')) return Promise.resolve(jsonResponse(200, { qrDataUrl: 'data:,', otpauthUrl: 'otpauth://x' }));
      if (url.includes('/api/auth/2fa/enable')) return Promise.resolve(jsonResponse(200, { recoveryCodes: ['aaaa-1111', 'bbbb-2222'] }));
      return routeFetch(url, init);
    });
    renderPage();
    fireEvent.click(await screen.findByRole('switch', { name: 'Двухфакторная защита' }));
    fireEvent.change(await screen.findByLabelText('Код из приложения'), { target: { value: '123456' } });
    fireEvent.click(screen.getByText('Подтвердить'));
    await screen.findByText('aaaa-1111');
    await waitFor(() => expect(fetchMock.mock.calls.filter(([u]) => String(u).includes('/api/auth/me')).length).toBe(2));
    expect(screen.getByText('aaaa-1111')).toBeTruthy();
  });
});

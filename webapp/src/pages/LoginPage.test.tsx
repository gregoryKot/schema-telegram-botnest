// @vitest-environment jsdom
// LoginPage: вход через VK ID и Яндекс ID (OAuth-редиректы), Telegram
// fallback и редирект уже вошедших пользователей. Мокаем global fetch
// напрямую (компонент ходит через fetch, не через '../api') — образец:
// MergePage.test.tsx / AuthCallback.test.tsx. getHost() мокается целиком:
// реальный getHost() каждый вызов заново детектит хост по window.Telegram и
// затирает любую попытку подменить его через setHost в jsdom-окружении, где
// window.Telegram нет.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AuthContext, type AuthState } from '../auth/authContext';
import { AddressFormContext } from '../utils/addressForm';
import { LoginPage } from './LoginPage';
import { rememberReturnTo, AUTH_RETURN_KEY } from '../auth/returnTo';
import { wipeAfterAccountDeletion } from '../../../shared/src/account/accountDeletion';

vi.mock('../../../shared/src/host', () => ({
  getHost: vi.fn(() => ({ sessionExchange: () => null })),
}));
import { getHost } from '../../../shared/src/host';
const mockGetHost = getHost as unknown as ReturnType<typeof vi.fn>;

vi.mock('../api', () => ({ reportClientError: vi.fn() }));
import { reportClientError } from '../api';

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  mockGetHost.mockReturnValue({ sessionExchange: () => null });
});

afterEach(() => {
  cleanup();
  vi.mocked(reportClientError).mockClear();
  vi.unstubAllGlobals();
});

function authValue(overrides: Partial<AuthState> = {}): AuthState {
  const value: AuthState = {
    accessToken: null,
    isLoading: false,
    isAuthenticated: false,
    authError: null,
    setAccessToken: vi.fn(),
    getAccessToken: () => value.accessToken,
    logout: vi.fn(),
    refreshToken: vi.fn(),
    ...overrides,
  };
  return value;
}

function renderPage(auth: AuthState = authValue(), initialPath = '/login') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthContext.Provider value={auth}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/today" element={<div>today-page</div>} />
          <Route path="/diary" element={<DiaryProbe />} />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

function DiaryProbe() {
  return <div>diary-page {useLocation().search}</div>;
}

// Подзаголовок берёт форму там же, где строки согласия ниже (useTr), а не стоит на «вы» один.
describe('LoginPage — подзаголовок в форме человека', () => {
  it.each([
    ['ty', 'Войди, чтобы продолжить', /подтверждаешь/],
    ['vy', 'Войдите, чтобы продолжить', /подтверждаете/],
  ] as const)('форма %s: «%s», согласие — в той же форме', (form, sub, consent) => {
    render(
      <AddressFormContext.Provider value={{ form, setForm: vi.fn() }}>
        <MemoryRouter initialEntries={['/login']}>
          <AuthContext.Provider value={authValue()}>
            <LoginPage />
          </AuthContext.Provider>
        </MemoryRouter>
      </AddressFormContext.Provider>,
    );
    expect(screen.getByText(`${sub}. Первый вход сам создаст аккаунт — регистрация не нужна`)).toBeTruthy();
    expect(screen.getByTestId('login-consent-note').textContent).toMatch(consent);
  });
});

// QA 2026-11, К2: после удаления аккаунта экран входа писал «Вход устарел —
// данные на месте»: человек решал, что удаление не прошло.
describe('LoginPage — сразу после удаления аккаунта', () => {
  it('говорит «Аккаунт удалён», а не «данные на месте»; отметка одноразовая', () => {
    localStorage.setItem('auth_seen', '1');
    wipeAfterAccountDeletion();
    renderPage();
    expect(screen.getByText(/^Аккаунт удалён/)).toBeTruthy();
    expect(screen.queryByText(/данные на месте/)).toBeNull();
    expect(localStorage.getItem('account_deleted')).toBeNull();
  });
});

describe('LoginPage — уже вошедший пользователь', () => {
  it('isAuthenticated=true сразу уводит на /today', async () => {
    renderPage(authValue({ isAuthenticated: true }));
    await screen.findByText('today-page');
  });

  // E14 (аудит 2026-11): после входа — туда, откуда увели на вход (RequireAuth).
  it('после входа возвращает на адрес, с которого увели, с query; адрес одноразовый', async () => {
    rememberReturnTo('/diary?tab=schemas');
    renderPage(authValue({ isAuthenticated: true }));
    await screen.findByText('diary-page ?tab=schemas');
    expect(sessionStorage.getItem(AUTH_RETURN_KEY)).toBeNull();
  });

  it('подложенный чужой адрес не уводит с сайта — /today', async () => {
    sessionStorage.setItem(AUTH_RETURN_KEY, '//evil.com/phish');
    renderPage(authValue({ isAuthenticated: true }));
    await screen.findByText('today-page');
  });
});

describe('LoginPage — обычный браузер (не Telegram)', () => {
  it('показывает способы входа сайта: ВКонтакте и Яндекс', () => {
    renderPage();
    expect(screen.getByRole('link', { name: /Войти через ВКонтакте/ })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Войти через Яндекс/ }).getAttribute('href')).toBe('/api/auth/yandex');
  });

  // Вход по почте отключён (решение владельца, ч. 10 ст. 8 149-ФЗ): ни кнопки, ни поля адреса.
  it('входа по почте нет: ни кнопки, ни поля, ни запроса письма', () => {
    const { container } = renderPage(authValue(), '/login?via=email');
    expect(screen.queryByRole('button', { name: /email|почт/i })).toBeNull();
    expect(container.querySelector('input[type="email"]')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // Запрос РКН №08-1063539 (2026-11): пользователей из России нельзя
  // авторизовать через иностранный сервис. Ни Google, ни Telegram: кнопок и
  // ссылок входа нет, страница к их ручкам не ходит, а прежним пользователям
  // сказано, как попасть в свой аккаунт.
  it('входа через Google и Telegram нет; прежним пользователям — подсказка', () => {
    const { container } = renderPage();
    expect(screen.queryByRole('link', { name: /Google/ })).toBeNull();
    expect(screen.queryByRole('link', { name: /Войти через Telegram/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Telegram/ })).toBeNull();
    expect(container.innerHTML).not.toMatch(
      /api\/auth\/telegram|api\/auth\/google|oauth\.telegram|start=login_/,
    );
    expect(screen.getByTestId('login-email-note').textContent).toContain('Вход по почте отключён');
    expect(screen.getByTestId('login-telegram-note').textContent).toContain('добавь там VK ID или Яндекс ID');
    // Во вкладке браузера билет входа не выписывается — страница молчит.
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// В5 (аудит 2026-08): AuthCallback.tsx уводит сюда с ?error=no_token, когда
// OAuth-провайдер не вернул токен (например, окно входа закрылось раньше
// времени) — до этой правки /login эту query никогда не читал, и человек
// просто видел форму входа заново без единого слова о провале.
describe('LoginPage — провал OAuth (?error=no_token)', () => {
  it('показывает нейтральное сообщение о провале входа', () => {
    renderPage(authValue(), '/login?error=no_token');
    expect(screen.getByText(/Вход не получился/)).toBeTruthy();
  });

  it('текст провала безличный: без «Попробуй»/«Попробуйте»', () => {
    renderPage(authValue(), '/login?error=no_token');
    expect(
      screen.getByText(
        'Вход не получился: окно входа закрылось раньше времени. Можно попробовать ещё раз.',
      ),
    ).toBeTruthy();
  });

  // Ревью b26: сбой стоит у того, к чему относится, — над кнопками входа, выше сгиба.
  it('провал OAuth — над кнопками входа, одно сообщение', () => {
    renderPage(authValue(), '/login?error=no_token');
    const alert = screen.getByRole('alert');
    const vk = screen.getByRole('link', { name: /Войти через ВКонтакте/ });
    expect(alert.compareDocumentPosition(vk) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getAllByRole('alert')).toHaveLength(1);
  });

  it('без ?error никакого сообщения нет', () => {
    renderPage();
    expect(screen.queryByText(/Вход не получился/)).toBeNull();
  });

  it('знак в шапке входа ведёт на главную сайта (владелец 2026-11-07)', () => {
    renderPage();
    expect(screen.getByRole('link', { name: 'На главную' }).getAttribute('href')).toBe('/');
  });

  it('провал уходит в телеметрию (не только сломанный вход в мессенджере)', async () => {
    mockGetHost.mockReturnValue({ id: 'web', sessionExchange: () => null });
    renderPage(authValue(), '/login?error=no_token');
    await waitFor(() => expect(reportClientError).toHaveBeenCalledTimes(1));
    const payload = vi.mocked(reportClientError).mock.calls[0][0];
    expect(payload.section).toBe('auth');
    expect(payload.message).toContain('хост=web');
    expect(payload.message).toContain('Вход не получился');
  });
});

describe('LoginPage — внутри Telegram (авто-вход не удался)', () => {
  it('показывает мини-экран retry вместо полной формы входа', () => {
    mockGetHost.mockReturnValue({
      sessionExchange: () => ({ path: '/api/auth/telegram/exchange', body: { initData: 'x' } }),
    });
    renderPage();
    expect(screen.getByText('Не удалось войти автоматически')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Попробовать снова' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Войти через ВКонтакте/ })).toBeNull();
  });

  // Пара к AppErrorScreen мини-аппа: экран-тупик обязан назвать адрес, а не
  // отправлять «нам» (скриншот владельца, 2026-08-10).
  it('называет, кому написать, если retry не помогает', () => {
    mockGetHost.mockReturnValue({
      id: 'telegram',
      sessionExchange: () => ({ path: '/api/auth/telegram/exchange', body: { initData: 'x' } }),
    });
    renderPage();
    expect(screen.getByRole('link', { name: /@kotlarewski/ }).getAttribute('href'))
      .toBe('https://t.me/kotlarewski');
  });

  it('в MAX даёт почту — телеграмной ссылки там не открыть', () => {
    mockGetHost.mockReturnValue({
      id: 'max',
      sessionExchange: () => ({ path: '/api/auth/max/webapp', body: { initData: 'x' } }),
    });
    renderPage();
    expect(screen.getByRole('link', { name: /gregorykot@gmail\.com/ }).getAttribute('href'))
      .toBe('mailto:gregorykot@gmail.com');
  });

  // Парная правка к AppErrorScreen мини-аппа (правило №3). Инцидент
  // 2026-08-08: вход был сломан у всех пользователей Telegram, экран об этом
  // говорил пользователю и молчал нам — телеметрия висела только на крашах.
  it('неудачный вход в мессенджере уезжает в телеметрию', async () => {
    mockGetHost.mockReturnValue({
      id: 'telegram',
      sessionExchange: () => ({
        path: '/api/auth/telegram/exchange',
        body: { initData: '' },
      }),
    });
    fetchMock.mockResolvedValue(jsonResponse(401, {}));
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Попробовать снова' }));

    await screen.findByText(/Ошибка 401/);
    // Ждём именно отчёт, а не текст ошибки: это два отдельных следствия
    // одного провала, и порядок между ними не гарантирован. Дождавшись
    // текста, тест раньше сразу проверял телеметрию — под нагрузкой на
    // раннере отчёт ещё не успевал уйти (флак 2026-08-11).
    await waitFor(() => expect(reportClientError).toHaveBeenCalledTimes(1));
    const payload = vi.mocked(reportClientError).mock.calls[0][0];
    expect(payload.section).toBe('auth');
    expect(payload.message).toContain('хост=telegram');
    expect(payload.message).toContain('подпись ПУСТАЯ');
  });

  it('«Попробовать снова» с ошибкой сервера показывает код ответа, не роняет экран', async () => {
    mockGetHost.mockReturnValue({
      sessionExchange: () => ({ path: '/api/auth/telegram/exchange', body: { initData: 'x' } }),
    });
    fetchMock.mockResolvedValue(jsonResponse(401, {}));
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Попробовать снова' }));

    await screen.findByText(/Ошибка 401/);
  });
});

// Аудит 2026-10, «сырой текст сервера на экранах входа»: при лимите экран
// показывал «ThrottlerException: Too Many Requests». Ответ — настоящий
// Response в старой форме тела (голая JSON-строка): разбор идёт тем же путём, что в проде.
const throttledLegacy = () =>
  new Response('"ThrottlerException: Too Many Requests"', { status: 429 });

describe('LoginPage — «Попробовать снова» в мессенджере: лимит и авария', () => {
  beforeEach(() => {
    mockGetHost.mockReturnValue({
      id: 'telegram',
      sessionExchange: () => ({ path: '/api/auth/telegram/exchange', body: { initData: 'x' } }),
    });
  });

  it('429 — код ответа остаётся, вместо «ThrottlerException» человеческий текст', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(throttledLegacy()));
    const { container } = renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Попробовать снова' }));
    // На экране — короткий код (ревью b26), человеческий текст целиком — в отчёте.
    await screen.findByText('Ошибка 429');
    expect(container.textContent).not.toMatch(/Throttler/);
    await waitFor(() => expect(reportClientError).toHaveBeenCalled());
    expect(vi.mocked(reportClientError).mock.calls[0][0].message).toContain('Ошибка 429: Слишком много попыток подряд. Повторить можно чуть позже');
  });

  it('502 HTML прокси — код ответа и «сервер не ответил», без разметки', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(new Response('<html><body>502 Bad Gateway</body></html>', { status: 502 })));
    const { container } = renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Попробовать снова' }));
    await screen.findByText('Ошибка 502');
    expect(container.textContent).not.toMatch(/<html|Bad Gateway/);
    await waitFor(() => expect(reportClientError).toHaveBeenCalled());
    expect(vi.mocked(reportClientError).mock.calls[0][0].message).toContain('Ошибка 502: Сервер не ответил');
  });

  it('обрыв сети — «Нет связи с сервером», не «TypeError: Failed to fetch»', async () => {
    fetchMock.mockImplementation(() => Promise.reject(new TypeError('Failed to fetch')));
    const { container } = renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Попробовать снова' }));
    await screen.findByText('Нет связи с сервером');
    expect(container.textContent).not.toMatch(/TypeError/);
  });

  // Аудит 2026-10: запасным текстом был сам String(e) — HTML прокси на 200
  // давал на экране «SyntaxError: Unexpected token '<'…». Имя класса остаётся:
  // строка уходит и в отчёт useAuthFailureReport.
  it('200 с HTML вместо JSON — «Не удалось войти», без сырого текста разбора', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(new Response('<html><body>Bad Gateway</body></html>', { status: 200 })));
    const { container } = renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Попробовать снова' }));
    await screen.findByText('Не удалось войти (SyntaxError)');
    expect(container.textContent).not.toMatch(/Unexpected token|<html|is not valid JSON/);
    await waitFor(() => expect(reportClientError).toHaveBeenCalledTimes(1));
    expect(vi.mocked(reportClientError).mock.calls[0][0].message).toContain('SyntaxError');
  });

  it('контроль: русский текст исключения проходит как есть', async () => {
    fetchMock.mockImplementation(() => Promise.reject(new Error('Сессия мессенджера устарела')));
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Попробовать снова' }));
    await screen.findByText('Сессия мессенджера устарела');
  });

  it('401 — тело сервера как есть: диагностика отказа подписи (инцидент 2026-08-08)', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(new Response('{"message":"Missing authentication","statusCode":401}', { status: 401 })));
    const { container } = renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Попробовать снова' }));
    // Сырой JSON сервера — в отчёт, не на экран (ревью b26): там только «Ошибка 401».
    await screen.findByText('Ошибка 401');
    expect(container.textContent).not.toMatch(/Missing authentication|statusCode/);
    await waitFor(() => expect(reportClientError).toHaveBeenCalled());
    expect(vi.mocked(reportClientError).mock.calls[0][0].message).toMatch(/Ошибка 401: .*Missing authentication/);
  });
});

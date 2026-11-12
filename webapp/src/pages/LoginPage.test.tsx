// @vitest-environment jsdom
// LoginPage: три способа входа (OAuth-редиректы, email magic-link, Telegram
// fallback) плюс редирект уже вошедших пользователей. Мокаем global fetch
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
  return {
    accessToken: null,
    isLoading: false,
    isAuthenticated: false,
    setAccessToken: vi.fn(),
    logout: vi.fn(),
    refreshToken: vi.fn(),
    ...overrides,
  };
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
    expect(screen.getByText(sub)).toBeTruthy();
    expect(screen.getByTestId('login-consent-note').textContent).toMatch(consent);
  });

  it('без провайдера (так живёт /login) весь экран в одной форме', () => {
    renderPage();
    expect(screen.getByText('Войди, чтобы продолжить')).toBeTruthy();
    expect(screen.getByTestId('login-consent-note').textContent).toMatch(/подтверждаешь/);
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
  it('показывает способы входа сайта: ВКонтакте и почту', () => {
    renderPage();
    expect(screen.getByRole('link', { name: /Войти через ВКонтакте/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /email/i })).toBeTruthy();
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
    expect(screen.getByTestId('login-google-note').textContent).toContain('с той же почтой');
    expect(screen.getByTestId('login-telegram-note').textContent).toContain('почту или VK ID');
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

  // Аудит 2026-10: /login вне AddressFormProvider — useTr() всегда давал «ты».
  it('текст провала безличный: без «Попробуй»/«Попробуйте»', () => {
    renderPage(authValue(), '/login?error=no_token');
    expect(
      screen.getByText(
        'Вход не получился: окно входа закрылось раньше времени. Можно попробовать ещё раз.',
      ),
    ).toBeTruthy();
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

/** Запросы письма среди прочих: экран сам выписывает билет входа при открытии. */
function emailCalls() {
  return fetchMock.mock.calls.filter(([url]) =>
    String(url).includes('/api/auth/email/link'),
  );
}

describe('LoginPage — email magic-link', () => {
  it('невалидный email — ошибка видна, запрос не уходит', () => {
    const { container } = renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Войти по email' }));
    const input = screen.getByPlaceholderText('your@email.com');
    fireEvent.change(input, { target: { value: 'not-an-email' } });
    // Клик по type="submit" в jsdom не инициирует нативный submit формы —
    // сабмитим форму напрямую, как реальный браузер по Enter/клику.
    fireEvent.submit(container.querySelector('form')!);
    expect(screen.getByText('Адрес почты выглядит неверно')).toBeTruthy();
    // Билет входа экран выписывает сам при открытии — считаем только запросы
    // письма, иначе тест ловил бы чужой вызов.
    expect(emailCalls()).toHaveLength(0);
  });

  it('валидный email → письмо отправлено, показан экран подтверждения (read-after-write)', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}));
    const { container } = renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Войти по email' }));
    fireEvent.change(screen.getByPlaceholderText('your@email.com'), { target: { value: 'me@example.com' } });
    fireEvent.submit(container.querySelector('form')!);

    await screen.findByText('Письмо отправлено');
    const [, init] = emailCalls()[0];
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ email: 'me@example.com' });
  });

  it('ошибка API при отправке письма — видна пользователю, экран успеха НЕ показывается', async () => {
    fetchMock.mockResolvedValue(jsonResponse(500, { message: 'Сервер недоступен' }));
    const { container } = renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Войти по email' }));
    fireEvent.change(screen.getByPlaceholderText('your@email.com'), { target: { value: 'me@example.com' } });
    fireEvent.submit(container.querySelector('form')!);

    await screen.findByText('Сервер недоступен');
    expect(screen.queryByText('Письмо отправлено')).toBeNull();
  });

  // errorAt (ревью b26): сбой стоит у того, к чему относится. Ошибка почты — сразу под полем, над кнопкой
  // «Отправить ссылку» (на 390 стояла под «Отменой», ниже сгиба); провал OAuth — над кнопками входа.
  it('ошибка почты — под полем, до кнопки отправки; у кнопок входа её нет', () => {
    const { container } = renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Войти по email' }));
    fireEvent.change(screen.getByPlaceholderText('your@email.com'), { target: { value: 'nope' } });
    fireEvent.submit(container.querySelector('form')!);
    const alert = screen.getByRole('alert');
    const form = container.querySelector('form.al-email')!;
    expect(form.contains(alert)).toBe(true);
    const input = screen.getByPlaceholderText('your@email.com');
    const submit = screen.getByRole('button', { name: 'Отправить ссылку' });
    expect(input.compareDocumentPosition(alert) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(alert.compareDocumentPosition(submit) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getAllByRole('alert')).toHaveLength(1);
  });

  it('провал OAuth — у кнопок входа, до них, а не у почты', () => {
    renderPage(authValue(), '/login?error=no_token');
    const alert = screen.getByRole('alert');
    const email = screen.getByRole('button', { name: 'Войти по email' });
    expect(alert.compareDocumentPosition(email) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getAllByRole('alert')).toHaveLength(1);
  });

  it('«Отмена» возвращает к списку способов входа', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Войти по email' }));
    fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));
    expect(screen.getByRole('button', { name: 'Войти по email' })).toBeTruthy();
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
// показывал «ThrottlerException: Too Many Requests» (или «Ошибка 429»), при
// обрыве сети — «Failed to fetch». Ответы — настоящие Response, не подделки:
// разбор тела идёт тем же путём, что в проде. Тело 429 — в форме, которую
// сервер отдаёт после починки (держит src/api/throttler-module-options.spec.ts
// на настоящем гарде), и в старой — голая JSON-строка.
const THROTTLED_RU = 'Слишком много попыток подряд. Повторить можно через минуту';
const throttled = () =>
  new Response(JSON.stringify({ statusCode: 429, message: THROTTLED_RU }), { status: 429 });
const throttledLegacy = () =>
  new Response('"ThrottlerException: Too Many Requests"', { status: 429 });

/** Письмо падает выбранным ответом; остальные запросы экрана — 200 {}. */
function failEmailWith(fail: () => Response | Error) {
  fetchMock.mockImplementation((url: string) => {
    if (!String(url).includes('/api/auth/email/link')) {
      return Promise.resolve(new Response('{}', { status: 200 }));
    }
    const out = fail();
    return out instanceof Error ? Promise.reject(out) : Promise.resolve(out);
  });
}

function submitEmail(container: HTMLElement) {
  fireEvent.click(screen.getByRole('button', { name: 'Войти по email' }));
  fireEvent.change(screen.getByPlaceholderText('your@email.com'), { target: { value: 'me@example.com' } });
  fireEvent.submit(container.querySelector('form')!);
}

describe('LoginPage — ошибки письма входа человеческим текстом', () => {
  it('контроль: 429 — русский текст сервера со сроком проходит как есть', async () => {
    failEmailWith(throttled);
    const { container } = renderPage();
    submitEmail(container);
    await screen.findByText(THROTTLED_RU);
    expect(container.textContent).not.toMatch(/Throttler|Ошибка 429/);
  });

  it('429 старой формы — общий текст про лимит', async () => {
    failEmailWith(throttledLegacy);
    const { container } = renderPage();
    submitEmail(container);
    await screen.findByText('Слишком много попыток подряд. Повторить можно чуть позже');
    expect(container.textContent).not.toMatch(/Throttler/);
  });

  it('обрыв сети — «Нет связи с сервером», не «Failed to fetch»', async () => {
    failEmailWith(() => new TypeError('Failed to fetch'));
    const { container } = renderPage();
    submitEmail(container);
    await screen.findByText('Нет связи с сервером');
    expect(container.textContent).not.toMatch(/Failed to fetch/);
  });

  it('400 ValidationPipe по-английски — запасной текст экрана', async () => {
    failEmailWith(() => new Response('{"statusCode":400,"message":["email must be an email"]}', { status: 400 }));
    const { container } = renderPage();
    submitEmail(container);
    await screen.findByText('Не удалось отправить письмо');
  });
});

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

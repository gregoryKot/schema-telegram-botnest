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
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthContext, type AuthState } from '../auth/authContext';
import { LoginPage } from './LoginPage';

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
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

describe('LoginPage — уже вошедший пользователь', () => {
  it('isAuthenticated=true сразу уводит на /today', async () => {
    renderPage(authValue({ isAuthenticated: true }));
    await screen.findByText('today-page');
  });
});

describe('LoginPage — обычный браузер (не Telegram)', () => {
  it('показывает три способа входа', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /Войти через Google/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Войти через ВКонтакте/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Войти через Telegram/ })).toBeTruthy();
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

  it('без ?error никакого сообщения нет', () => {
    renderPage();
    expect(screen.queryByText(/Вход не получился/)).toBeNull();
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

describe('LoginPage — email magic-link', () => {
  it('невалидный email — ошибка видна, запрос не уходит', () => {
    const { container } = renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Войти по email' }));
    const input = screen.getByPlaceholderText('your@email.com');
    fireEvent.change(input, { target: { value: 'not-an-email' } });
    // Клик по type="submit" в jsdom не инициирует нативный submit формы —
    // сабмитим форму напрямую, как реальный браузер по Enter/клику.
    fireEvent.submit(container.querySelector('form')!);
    expect(screen.getByText('Введи корректный email')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('валидный email → письмо отправлено, показан экран подтверждения (read-after-write)', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}));
    const { container } = renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Войти по email' }));
    fireEvent.change(screen.getByPlaceholderText('your@email.com'), { target: { value: 'me@example.com' } });
    fireEvent.submit(container.querySelector('form')!);

    await screen.findByText('Письмо отправлено');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/auth/email/link');
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
    expect(screen.queryByRole('button', { name: /Войти через Google/ })).toBeNull();
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

// @vitest-environment jsdom
// Страница ввода 2FA-кода после первичного логина. Мокаем global fetch
// напрямую (компонент ходит через fetch, не через '../api') — образец:
// MergePage.test.tsx / LoginPage.test.tsx. Клик по type="submit" в jsdom не
// запускает нативный submit — сабмитим форму напрямую (см. LoginPage.test.tsx).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthContext, type AuthState } from '../auth/authContext';
import { TwoFactorChallengePage } from './TwoFactorChallengePage';

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
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

function renderAt(path: string, auth: AuthState = authValue()) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthContext.Provider value={auth}>
        <Routes>
          <Route path="/auth/2fa" element={<TwoFactorChallengePage />} />
          <Route path="/login" element={<div>login-page</div>} />
          <Route path="/today" element={<div>today-page</div>} />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

describe('TwoFactorChallengePage — без токена вызова', () => {
  it('нет ?token в URL — сразу уводит на /login', async () => {
    renderAt('/auth/2fa');
    await screen.findByText('login-page');
  });
});

describe('TwoFactorChallengePage — ввод кода', () => {
  it('кнопка «Подтвердить» задизейблена, пока код пуст', () => {
    renderAt('/auth/2fa?token=chal123');
    expect((screen.getByRole('button', { name: /Подтвердить/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('успешный код → accessToken сохранён, уход на /today (read-after-write)', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { accessToken: 'tok-2fa', expiresIn: 900 }));
    const setAccessToken = vi.fn();
    const { container } = renderAt('/auth/2fa?token=chal123', authValue({ setAccessToken }));
    fireEvent.change(screen.getByPlaceholderText('123456'), { target: { value: '482913' } });
    fireEvent.submit(container.querySelector('form')!);

    await screen.findByText('today-page');
    expect(setAccessToken).toHaveBeenCalledWith('tok-2fa', 900);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/auth/2fa/challenge');
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ challengeToken: 'chal123', code: '482913' });
  });

  it('неверный код — ошибка показана, поле очищается, не уходит на /today', async () => {
    // Тело — как отдаёт прод (src/auth/auth-2fa.controller.ts: UnauthorizedException
    // 'Invalid 2FA code'), а не выдуманное «Неверный код» (правило №23): с
    // выдуманной фикстурой тест не видел, что экран показывает английский.
    fetchMock.mockResolvedValue(
      jsonResponse(401, { statusCode: 401, message: 'Invalid 2FA code', error: 'Unauthorized' }),
    );
    const { container } = renderAt('/auth/2fa?token=chal123');
    const input = screen.getByPlaceholderText('123456') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '000000' } });
    fireEvent.submit(container.querySelector('form')!);

    await screen.findByText('Неверный код');
    expect(screen.queryByText('today-page')).toBeNull();
    expect(input.value).toBe('');
  });
});

// Аудит frontend-ux: резервный код — 10 символов hex с буквами a–f
// (totp.service.ts), а цифровая клавиатура букв не даёт. Код из приложения —
// цифровая клавиатура и one-time-code; резервный — буквенная, без автозамены.
describe('TwoFactorChallengePage — клавиатура под каждый режим', () => {
  it('код из приложения: цифровая клавиатура, one-time-code, буквы отбрасываются', () => {
    renderAt('/auth/2fa?token=chal123');
    const input = screen.getByLabelText('Код из приложения') as HTMLInputElement;
    expect(input.getAttribute('inputmode')).toBe('numeric');
    expect(input.getAttribute('autocomplete')).toBe('one-time-code');
    fireEvent.change(input, { target: { value: '12a3b4' } });
    expect(input.value).toBe('1234');
  });

  it('резервный код: буквенная клавиатура, без one-time-code и автозаглавной, буквы a–f проходят', () => {
    renderAt('/auth/2fa?token=chal123');
    fireEvent.click(screen.getByRole('button', { name: /recovery-код/ }));
    const input = screen.getByLabelText('Recovery-код') as HTMLInputElement;
    expect(input.getAttribute('inputmode')).toBe('text');
    expect(input.getAttribute('autocomplete')).not.toBe('one-time-code');
    expect(input.getAttribute('autocapitalize')).toBe('off');
    fireEvent.change(input, { target: { value: '3fa9c0be17' } });
    expect(input.value).toBe('3fa9c0be17');
  });
});

describe('TwoFactorChallengePage — recovery-код', () => {
  it('переключение на recovery-код принимает hex и отправляет без пробелов, дефисов и заглавных', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { accessToken: 't', expiresIn: 900 }));
    const { container } = renderAt('/auth/2fa?token=chal123');
    fireEvent.click(screen.getByRole('button', { name: /recovery-код/ }));
    fireEvent.change(screen.getByLabelText('Recovery-код'), { target: { value: 'AB12 cd34-EF' } });
    fireEvent.submit(container.querySelector('form')!);
    await screen.findByText('today-page');
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse((init as RequestInit).body as string).code).toBe('ab12cd34ef');
  });
});

// Аудит 2026-10, «сырой текст сервера на экранах входа»: на лимит и аварию
// экран отвечал «Неверный код» (или «ThrottlerException…») — человек решал, что
// ошибся с кодом, и тратил попытки дальше. Ответы — настоящие Response.
describe('TwoFactorChallengePage — лимит, авария и сеть не выдаются за неверный код', () => {
  async function submitWith(reply: () => Promise<Response>) {
    fetchMock.mockImplementation(reply);
    const { container } = renderAt('/auth/2fa?token=chal123');
    fireEvent.change(screen.getByPlaceholderText('123456'), { target: { value: '000000' } });
    fireEvent.submit(container.querySelector('form')!);
    return container;
  }

  it('контроль: 429 — русский текст сервера проходит как есть', async () => {
    const text = 'Слишком много попыток подряд. Повторить можно через 12 минут';
    const container = await submitWith(() =>
      Promise.resolve(new Response(JSON.stringify({ statusCode: 429, message: text }), { status: 429 })));
    await screen.findByText(text);
    expect(container.textContent).not.toMatch(/Неверный код|Throttler/);
  });

  it('429 старой формы (голая строка) — общий текст про лимит, не «Неверный код»', async () => {
    const container = await submitWith(() =>
      Promise.resolve(new Response('"ThrottlerException: Too Many Requests"', { status: 429 })));
    await screen.findByText('Слишком много попыток подряд. Повторить можно чуть позже');
    expect(container.textContent).not.toMatch(/Неверный код|Throttler/);
  });

  it('502 HTML прокси — «сервер не ответил», не «Неверный код»', async () => {
    const container = await submitWith(() =>
      Promise.resolve(new Response('<html>502 Bad Gateway</html>', { status: 502 })));
    await screen.findByText('Сервер не ответил. Повторить можно чуть позже');
    expect(container.textContent).not.toMatch(/Неверный код/);
  });

  it('обрыв сети — «Нет связи с сервером»', async () => {
    const container = await submitWith(() => Promise.reject(new TypeError('Load failed')));
    await screen.findByText('Нет связи с сервером');
    expect(container.textContent).not.toMatch(/Load failed|TypeError/);
  });
});

// Аудит 2026-10: протухший вызов (5 минут, src/auth/totp-challenge.ts) сервер
// отдавал тем же 401, что неверный код, и экран писал «Неверный код» — человек
// вводил код снова и снова. Тело — как отдаёт прод (ChallengeExpiredException).
describe('TwoFactorChallengePage — вход устарел', () => {
  const submit401 = (body: unknown, code: string) => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(body), { status: 401 }));
    const view = renderAt('/auth/2fa?token=chal123');
    fireEvent.change(screen.getByPlaceholderText('123456'), { target: { value: code } });
    fireEvent.submit(view.container.querySelector('form')!);
    return view.container;
  };

  it('401 с reason challenge_expired — «Вход устарел» и путь на вход, не «Неверный код»', async () => {
    const container = submit401({ message: 'Invalid or expired 2FA challenge token', reason: 'challenge_expired' }, '482913');
    await screen.findByText(/Вход устарел/);
    expect(container.textContent).not.toMatch(/Неверный код|Invalid/);
    expect(screen.queryByPlaceholderText('123456')).toBeNull();
    // Шапка «Код из приложения-аутентификатора» над «Войти заново» сбивала бы с толку.
    expect(screen.queryByText('Двухфакторная проверка')).toBeNull();
    expect(container.textContent).not.toMatch(/Код из приложения/);
    fireEvent.click(screen.getByRole('button', { name: 'Войти заново' }));
    await screen.findByText('login-page');
  });

  it('контроль: 401 неверного кода (без reason) — «Неверный код», форма на месте', async () => {
    submit401({ statusCode: 401, message: 'Invalid 2FA code', error: 'Unauthorized' }, '000000');
    await screen.findByText('Неверный код');
    expect(screen.queryByText(/Вход устарел/)).toBeNull();
    expect(screen.getByPlaceholderText('123456')).toBeTruthy();
    expect(screen.getByText('Двухфакторная проверка')).toBeTruthy();
  });
});

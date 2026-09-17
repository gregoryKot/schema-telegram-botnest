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
  it('кнопка «Войти» задизейблена, пока код пуст', () => {
    renderAt('/auth/2fa?token=chal123');
    expect((screen.getByRole('button', { name: /Войти/ }) as HTMLButtonElement).disabled).toBe(true);
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
    fetchMock.mockResolvedValue(jsonResponse(401, { message: 'Неверный код' }));
    const { container } = renderAt('/auth/2fa?token=chal123');
    const input = screen.getByPlaceholderText('123456') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '000000' } });
    fireEvent.submit(container.querySelector('form')!);

    await screen.findByText('Неверный код');
    expect(screen.queryByText('today-page')).toBeNull();
    expect(input.value).toBe('');
  });
});

// @vitest-environment jsdom
// RecoveryPage: два режима (запрос ссылки / потребление magic-link по
// ?token=). Мокаем global fetch напрямую (компонент ходит через fetch, не
// через '../api') — образец: MergePage.test.tsx. Клик по type="submit" в
// jsdom не запускает нативный submit формы (см. LoginPage.test.tsx) —
// сабмитим форму напрямую через fireEvent.submit.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthContext, type AuthState } from '../auth/authContext';
import { RecoveryPage } from './RecoveryPage';

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
          <Route path="/auth/recovery" element={<RecoveryPage />} />
          <Route path="/login" element={<div>login-page</div>} />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

describe('RecoveryPage — форма запроса ссылки', () => {
  it('кнопка отправки задизейблена, пока email пуст', () => {
    renderAt('/auth/recovery');
    expect((screen.getByRole('button', { name: /Отправить ссылку/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('успешный запрос → «Проверь почту», без выдуманных данных (read-after-write)', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}));
    const { container } = renderAt('/auth/recovery');
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'me@example.com' } });
    fireEvent.submit(container.querySelector('form')!);

    await screen.findByText('Проверь почту');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/auth/recovery/request');
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ email: 'me@example.com' });
  });

  it('ошибка API — видна пользователю, экран успеха НЕ показывается', async () => {
    fetchMock.mockResolvedValue(jsonResponse(404, { message: 'Такой email не привязан к аккаунту' }));
    const { container } = renderAt('/auth/recovery');
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'stranger@example.com' } });
    fireEvent.submit(container.querySelector('form')!);

    await screen.findByText(/Такой email не привязан к аккаунту/);
    expect(screen.queryByText('Проверь почту')).toBeNull();
  });

  it('со страницы «Проверь почту» кнопка ведёт на /login', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}));
    const { container } = renderAt('/auth/recovery');
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'me@example.com' } });
    fireEvent.submit(container.querySelector('form')!);
    await screen.findByText('Проверь почту');

    fireEvent.click(screen.getByRole('button', { name: 'На страницу входа' }));
    await screen.findByText('login-page');
  });
});

describe('RecoveryPage — подтверждение по токену (?token=...)', () => {
  it('успешное подтверждение сохраняет accessToken и уходит на /account', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { accessToken: 'new-tok', expiresIn: 900 }));
    const setAccessToken = vi.fn();
    render(
      <MemoryRouter initialEntries={['/auth/recovery?token=secret']}>
        <AuthContext.Provider value={authValue({ setAccessToken })}>
          <Routes>
            <Route path="/auth/recovery" element={<RecoveryPage />} />
            <Route path="/account" element={<div>account-page</div>} />
          </Routes>
        </AuthContext.Provider>
      </MemoryRouter>,
    );

    await screen.findByText('account-page');
    expect(setAccessToken).toHaveBeenCalledWith('new-tok', 900);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/auth/recovery/confirm');
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ token: 'secret' });
  });

  it('истёкшая/невалидная ссылка — понятная ошибка, не выдуманный успех', async () => {
    fetchMock.mockResolvedValue(jsonResponse(410, { message: 'Ссылка истекла' }));
    render(
      <MemoryRouter initialEntries={['/auth/recovery?token=stale']}>
        <AuthContext.Provider value={authValue()}>
          <Routes>
            <Route path="/auth/recovery" element={<RecoveryPage />} />
            <Route path="/account" element={<div>account-page</div>} />
          </Routes>
        </AuthContext.Provider>
      </MemoryRouter>,
    );

    await screen.findByText('Ссылка истекла');
    expect(screen.getByText('Не получилось')).toBeTruthy();
    expect(screen.queryByText('account-page')).toBeNull();
  });

  it('«Запросить новую ссылку» возвращает на форму запроса', async () => {
    fetchMock.mockResolvedValue(jsonResponse(410, { message: 'Ссылка истекла' }));
    render(
      <MemoryRouter initialEntries={['/auth/recovery?token=stale']}>
        <AuthContext.Provider value={authValue()}>
          <Routes>
            <Route path="/auth/recovery" element={<RecoveryPage />} />
          </Routes>
        </AuthContext.Provider>
      </MemoryRouter>,
    );
    await screen.findByText('Ссылка истекла');

    fireEvent.click(screen.getByRole('button', { name: 'Запросить новую ссылку' }));
    await screen.findByText('Потерял доступ?');
  });
});

// @vitest-environment jsdom
// Компонентные тесты MergePage — контур, где данные реально сливаются между
// аккаунтами (CLAUDE.md: см. src/auth/merge.service.ts на бэкенде). Мокаем
// global fetch напрямую (компонент ходит через fetch, не через '../api') —
// образец: AccountPage.test.tsx / AuthCallback.test.tsx.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthContext, type AuthState } from '../auth/authContext';
import { MergePage } from './MergePage';

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
    accessToken: 'tok123',
    isLoading: false,
    isAuthenticated: true,
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
          <Route path="/merge" element={<MergePage />} />
          <Route path="/account" element={<div>account-page</div>} />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

describe('MergePage — без токена', () => {
  it('без ?token в URL сразу уходит на /account', async () => {
    renderAt('/merge');
    await screen.findByText('account-page');
  });
});

describe('MergePage — сводка переносимых данных', () => {
  it('показывает реальные счётчики из ?summary, а не выдуманные', async () => {
    const summary = JSON.stringify({ Rating: 12, Note: 3 });
    renderAt(`/merge?token=abc&summary=${encodeURIComponent(summary)}&provider=Google&name=user%40gmail.com`);

    await screen.findByText('оценки потребностей');
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText('заметки')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('15 записей')).toBeTruthy();
  });

  it('на пустом переносимом аккаунте (summary={}) — явное "нет данных", не 0/NaN', async () => {
    renderAt('/merge?token=abc');

    await screen.findByText('Нет данных – объединение пройдёт без переноса.');
  });
});

describe('MergePage — подтверждение обязательно', () => {
  it('кнопка «Объединить» задизейблена, пока чекбокс не отмечен', async () => {
    renderAt('/merge?token=abc');
    await screen.findByText('Объединить аккаунты?');

    expect((screen.getByRole('button', { name: 'Объединить' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('после отметки чекбокса кнопка активна', async () => {
    renderAt('/merge?token=abc');
    await screen.findByText('Объединить аккаунты?');
    fireEvent.click(screen.getByRole('checkbox'));

    expect((screen.getByRole('button', { name: 'Объединить' }) as HTMLButtonElement).disabled).toBe(false);
  });
});

describe('MergePage — успешное объединение', () => {
  it('вызывает POST /api/auth/merge с токеном, обновляет accessToken и уходит на /account', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { accessToken: 'new-tok', expiresIn: 900 }));
    const setAccessToken = vi.fn();
    renderAt('/merge?token=secret-token', authValue({ setAccessToken }));
    await screen.findByText('Объединить аккаунты?');
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Объединить' }));

    await screen.findByText('account-page');
    expect(setAccessToken).toHaveBeenCalledWith('new-tok', 900);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/auth/merge');
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ token: 'secret-token' });
  });
});

describe('MergePage — ошибка объединения', () => {
  it('ошибка API показывает причину, не переходит на /account, чекбокс/кнопка остаются', async () => {
    fetchMock.mockResolvedValue(jsonResponse(409, { message: 'Токен истёк, запроси объединение заново' }));
    renderAt('/merge?token=secret-token');
    await screen.findByText('Объединить аккаунты?');
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Объединить' }));

    await screen.findByText(/Токен истёк, запроси объединение заново/);
    expect(screen.queryByText('account-page')).toBeNull();
    expect((screen.getByRole('button', { name: 'Объединить' }) as HTMLButtonElement).disabled).toBe(false);
  });
});

describe('MergePage — отмена', () => {
  it('«Отмена» уходит на /account без вызова api', async () => {
    renderAt('/merge?token=abc');
    await screen.findByText('Объединить аккаунты?');

    fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));

    await screen.findByText('account-page');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

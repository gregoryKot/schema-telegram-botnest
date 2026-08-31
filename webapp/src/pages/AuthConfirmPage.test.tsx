// @vitest-environment jsdom
// Экран сверки входа по билету — человек в цикле (разбор 2026-08-31).
//
// Держим ядро фикса device-code phishing: сервер больше не одобряет билет за
// вошедшего молча — одобрение здесь, явным нажатием, и «это не я» гасит билет.
// Мокаем global fetch напрямую (компонент ходит через fetch) — образец
// TwoFactorChallengePage.test.tsx.
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
import { AddressFormContext, type AddressForm } from '../utils/addressForm';
import { AuthConfirmPage } from './AuthConfirmPage';

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { ok: true }));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function authValue(): AuthState {
  return {
    accessToken: null,
    isLoading: false,
    isAuthenticated: false,
    setAccessToken: vi.fn(),
    logout: vi.fn(),
    refreshToken: vi.fn(),
  };
}

function renderAt(path: string, form: AddressForm = 'ty') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthContext.Provider value={authValue()}>
        <AddressFormContext.Provider value={{ form, setForm: vi.fn() }}>
          <Routes>
            <Route path="/auth/confirm" element={<AuthConfirmPage />} />
            <Route path="/today" element={<div>today-page</div>} />
          </Routes>
        </AddressFormContext.Provider>
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

const lastBody = () =>
  JSON.parse((fetchMock.mock.calls.at(-1)![1] as RequestInit).body as string);
const lastUrl = () => fetchMock.mock.calls.at(-1)![0] as string;

describe('AuthConfirmPage', () => {
  it('показывает код в сверяемом виде и обе кнопки', () => {
    renderAt('/auth/confirm?code=K7M2QX94');
    expect(screen.getByText('K7M2-QX94')).toBeTruthy();
    expect(screen.getByText(/впустить/i)).toBeTruthy();
    expect(screen.getByText('Это не я')).toBeTruthy();
    // Ничего не отправляем, пока человек не нажал.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('«Да» одобряет ИМЕННО этот код и уводит в приложение', async () => {
    renderAt('/auth/confirm?code=K7M2QX94');
    fireEvent.click(screen.getByText(/впустить/i));

    await waitFor(() => expect(screen.getByText('today-page')).toBeTruthy());
    expect(lastUrl()).toContain('/api/auth/ticket/confirm-login');
    expect(lastBody()).toEqual({ code: 'K7M2QX94' });
  });

  it('мёртвый/чужой код — честное «код не найден», без входа', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: false }));
    renderAt('/auth/confirm?code=ZZZZZZZZ');
    fireEvent.click(screen.getByText(/впустить/i));

    await waitFor(() => expect(screen.getByText(/Код не найден/)).toBeTruthy());
    expect(screen.queryByText('today-page')).toBeNull();
  });

  it('«Это не я» гасит билет и говорит, что доступ никто не получил', async () => {
    renderAt('/auth/confirm?code=K7M2QX94');
    fireEvent.click(screen.getByText('Это не я'));

    await waitFor(() =>
      expect(screen.getByText(/доступ никто не получил/i)).toBeTruthy(),
    );
    expect(lastUrl()).toContain('/api/auth/ticket/deny-login');
    expect(lastBody()).toEqual({ code: 'K7M2QX94' });
  });

  it('без кода на экране сверки делать нечего — уводит домой', async () => {
    renderAt('/auth/confirm');
    await waitFor(() => expect(screen.getByText('today-page')).toBeTruthy());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('форма «вы» — обращение без «ты»-строк', () => {
    const { container } = renderAt('/auth/confirm?code=K7M2QX94', 'vy');
    expect(container.textContent).toContain('вы открываете');
    expect(container.textContent).not.toMatch(/ты открываешь|нажми «Это не я»/);
  });
});

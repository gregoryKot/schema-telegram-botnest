// @vitest-environment jsdom
// Кабинет при включённой 2FA (S12, аудит 2026-11): привязка и отвязка способа
// входа без кода получают 403 totp_required — страница спрашивает код в общем
// окне (components/stepUp) и повторяет тот же запрос с `x-totp-code`. Окно
// приезжает из RequireAuth; здесь страница обёрнута в провайдер напрямую.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, fireEvent, cleanup, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext, type AuthState } from '../auth/authContext';
import { StepUpProvider } from '../components/stepUp/StepUpProvider';
import { AccountPage } from './AccountPage';

const res = (status: number, body: unknown = {}) => new Response(JSON.stringify(body), { status });
const NEED = { message: 'Нужен код двухфакторной защиты', reason: 'totp_required' };
const totpOf = (init?: RequestInit) => (init?.headers as Record<string, string> | undefined)?.['x-totp-code'];

let fetchMock: ReturnType<typeof vi.fn>;
let linkTokenReply: (init?: RequestInit) => Response;

beforeEach(() => {
  linkTokenReply = (init) => (totpOf(init) === '123456' ? res(200) : res(403, NEED));
  fetchMock = vi.fn((url: string, init?: RequestInit) => {
    if (url.includes('/api/auth/me')) {
      return Promise.resolve(res(200, {
        providers: [
          { provider: 'google', email: 'user@gmail.com', displayName: null },
          { provider: 'telegram', email: null, displayName: '@petya' },
        ],
        totp: { enabled: true, recoveryCodesLeft: 8 },
      }));
    }
    if (url.includes('/api/auth/unlink/')) return Promise.resolve(totpOf(init) === '123456' ? res(200) : res(403, NEED));
    if (url.includes('/api/auth/link-token')) return Promise.resolve(linkTokenReply(init));
    if (url.includes('/api/auth/ticket/start')) return Promise.resolve(res(200, { deviceCode: 'd', userCode: 'ABCD2345', expiresIn: 600, interval: 5 }));
    return Promise.resolve(res(200, null));
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const auth: AuthState = {
  accessToken: 'tok123', isLoading: false, isAuthenticated: true,
  setAccessToken: vi.fn(), logout: vi.fn().mockResolvedValue(undefined), refreshToken: vi.fn().mockResolvedValue(true),
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/account']}>
      <AuthContext.Provider value={auth}>
        <StepUpProvider><AccountPage /></StepUpProvider>
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

async function codeDialog() {
  await screen.findByText('Подтверди, что это ты');
  await act(() => new Promise((r) => setTimeout(r, 0))); // запись окна в истории легла
}

const calls = (part: string) => fetchMock.mock.calls.filter(([url]) => String(url).includes(part));

describe('AccountPage — отвязка при включённой 2FA', () => {
  it('403 totp_required → окно кода → повтор отвязки с кодом → список перечитан', async () => {
    renderPage();
    await screen.findByText('user@gmail.com');
    const row = screen.getByText('Google').closest('.aa-row') as HTMLElement;
    fireEvent.click(within(row).getByText('Отвязать'));
    fireEvent.click(within(screen.getByRole('dialog')).getByText('Отвязать'));

    await codeDialog();
    fireEvent.change(screen.getByLabelText('Код из приложения'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Подтвердить' }));

    await waitFor(() => expect(calls('/api/auth/me')).toHaveLength(2));
    const unlinks = calls('/api/auth/unlink/google');
    expect(unlinks).toHaveLength(2);
    expect(totpOf(unlinks[0][1] as RequestInit)).toBeUndefined();
    expect(totpOf(unlinks[1][1] as RequestInit)).toBe('123456');
    expect(screen.queryByText(/Нужен код/)).toBeNull();
  });
});

describe('AccountPage — привязка при включённой 2FA', () => {
  const stubHref = () => {
    Object.defineProperty(window, 'location', { configurable: true, value: { ...window.location, href: '' } });
  };
  const original = window.location;
  afterEach(() => Object.defineProperty(window, 'location', { configurable: true, value: original }));

  it('link-token просит код: после кода — редирект на провайдера', async () => {
    stubHref();
    renderPage();
    await screen.findByText('user@gmail.com');
    fireEvent.click(screen.getAllByText('Привязать')[0]); // VK (Google и Telegram уже привязаны)
    await codeDialog();
    fireEvent.change(screen.getByLabelText('Код из приложения'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Подтвердить' }));
    await waitFor(() => expect(window.location.href).toContain('/api/auth/vk'));
  });

  it('окно кода закрыто — на провайдера не уходим (без куки привязки вышел бы ДРУГОЙ аккаунт)', async () => {
    stubHref();
    renderPage();
    await screen.findByText('user@gmail.com');
    fireEvent.click(screen.getAllByText('Привязать')[0]);
    await codeDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));
    await waitFor(() => expect(screen.queryByText('Подтверди, что это ты')).toBeNull());
    expect(window.location.href).toBe('');
    expect(calls('/api/auth/link-token')).toHaveLength(1);
  });

  it('link-token упал не из-за кода — ошибка на экране, редиректа нет', async () => {
    linkTokenReply = () => res(500, { message: 'Сервер прилёг' });
    stubHref();
    renderPage();
    await screen.findByText('user@gmail.com');
    fireEvent.click(screen.getAllByText('Привязать')[0]);
    await screen.findByText('Сервер прилёг');
    expect(window.location.href).toBe('');
  });
});

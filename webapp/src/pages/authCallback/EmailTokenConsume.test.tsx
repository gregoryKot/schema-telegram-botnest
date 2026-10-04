// @vitest-environment jsdom
// Страница погашения ссылки из письма: на входе ?email_token=…, на выходе — POST
// и переход по исходу. Главное: токен гасится ОДНИМ POST-ом (не двумя) и
// стирается из адресной строки.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor, cleanup, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from '../../auth/AuthProvider';
import { AuthCallback } from '../AuthCallback';

const json = (status: number, body: unknown) =>
  ({ ok: status < 400, status, json: () => Promise.resolve(body) }) as Response;

let fetchMock: ReturnType<typeof vi.fn>;
let consumeReply: Response;

beforeEach(() => {
  consumeReply = json(200, { accessToken: 'AT', expiresIn: 900 });
  // AuthProvider при старте сам дёргает refresh — отвечаем 401; consume — по сценарию.
  fetchMock = vi.fn((url: string) =>
    Promise.resolve(String(url).endsWith('/email/consume') ? consumeReply : json(401, {})),
  );
  vi.stubGlobal('fetch', fetchMock);
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

function Where() {
  const l = useLocation();
  return <div>at:{l.pathname + l.search + l.hash}</div>;
}

function renderPage(search: string) {
  window.history.replaceState(null, '', `/auth/callback${search}`);
  return render(
    <MemoryRouter initialEntries={['/auth/callback']}>
      <AuthProvider>
        <Routes>
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

const consumeCalls = () =>
  fetchMock.mock.calls.filter((c) => String(c[0]).endsWith('/email/consume'));

describe('AuthCallback ← ссылка из письма (?email_token)', () => {
  it('показывает «Входим…», гасит токен одним POST, стирает его из адреса, ведёт на /today', async () => {
    renderPage('?email_token=raw-1');
    expect(screen.getByText('Входим…')).toBeTruthy();
    await screen.findByText('at:/today');
    expect(consumeCalls()).toHaveLength(1);
    expect(JSON.parse(consumeCalls()[0][1].body)).toEqual({ token: 'raw-1' });
    expect(window.location.search).toBe('');
  });

  it('с билетом входа → экран сверки /auth/confirm, а не молчаливое одобрение', async () => {
    renderPage('?email_token=raw-1&ticket=K7M2QX94');
    await screen.findByText(/at:\/auth\/confirm\?code=K7M2QX94#access_token=AT/);
  });

  it('аккаунт с 2FA → /auth/2fa?token=…', async () => {
    consumeReply = json(200, { challengeToken: 'CH' });
    renderPage('?email_token=raw-1');
    await screen.findByText('at:/auth/2fa?token=CH');
  });

  it('привязка почты → /account?linked=email', async () => {
    consumeReply = json(200, { linked: true });
    renderPage('?email_token=raw-1');
    await screen.findByText('at:/account?linked=email');
  });

  it('ссылка просрочена → /auth/error?reason=email_link_expired (экран отчитывается наверх)', async () => {
    consumeReply = json(401, { message: 'Token expired' });
    renderPage('?email_token=raw-1');
    await screen.findByText('at:/auth/error?reason=email_link_expired');
  });

  it('привязка открыта не в том браузере → /account?error=email_link_session', async () => {
    consumeReply = json(401, { reason: 'email_link_session' });
    renderPage('?email_token=raw-1');
    await screen.findByText('at:/account?error=email_link_session');
  });

  it('контрольный: без ?email_token POST не уходит (это обычный OAuth-колбэк)', async () => {
    renderPage('');
    await waitFor(() => expect(screen.getByText(/at:\/login\?error=no_token/)).toBeTruthy());
    expect(consumeCalls()).toHaveLength(0);
  });
});

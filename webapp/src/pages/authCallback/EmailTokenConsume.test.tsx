// @vitest-environment jsdom
// Страница погашения ссылки привязки почты из письма: на входе ?email_token=…,
// на выходе — POST и переход по исходу. Главное: токен гасится ОДНИМ POST-ом
// (не двумя) и стирается из адресной строки; входа по ссылке нет.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor, cleanup, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from '../../auth/AuthProvider';
import { useAuth } from '../../auth/authContext';
import { AuthCallback } from '../AuthCallback';

const json = (status: number, body: unknown) =>
  ({ ok: status < 400, status, json: () => Promise.resolve(body) }) as Response;

let fetchMock: ReturnType<typeof vi.fn>;
let consumeReply: Response;

beforeEach(() => {
  consumeReply = json(200, { linked: true });
  // AuthProvider при старте сам дёргает refresh — отвечаем 401; consume — по сценарию.
  fetchMock = vi.fn((url: string) =>
    Promise.resolve(
      String(url).endsWith('/email/consume') ? consumeReply : json(401, {}),
    ),
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
  const { accessToken } = useAuth();
  return (
    <>
      <div>at:{l.pathname + l.search + l.hash}</div>
      <div>tok:{accessToken ?? 'none'}</div>
    </>
  );
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
  it('показывает «Привязываем почту…», гасит токен одним POST, стирает его из адреса, ведёт на /account?linked=email', async () => {
    renderPage('?email_token=raw-1');
    expect(await screen.findByText('Привязываем почту…')).toBeTruthy();
    await screen.findByText('at:/account?linked=email');
    expect(consumeCalls()).toHaveLength(1);
    expect(JSON.parse(consumeCalls()[0][1].body)).toEqual({ token: 'raw-1' });
    expect(window.location.search).toBe('');
  });

  // Вход по почте отключён: старая ссылка входа, на которую сервер ещё отдаёт сессию
  // или 2FA, — экран ошибки ссылки; сессия страницей не принимается.
  it.each([
    ['сессия', { accessToken: 'AT', expiresIn: 900 }],
    ['2FA', { challengeToken: 'CH' }],
  ])('старая ссылка входа (%s) → /auth/error?reason=email_link_expired, входа нет', async (_n, body) => {
    consumeReply = json(200, body);
    renderPage('?email_token=raw-1&ticket=K7M2QX94&return_to=%2Fdiary');
    await screen.findByText('at:/auth/error?reason=email_link_expired');
    expect(screen.getByText('tok:none')).toBeTruthy();
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

  // U6-хвост (аудит 2026-11): сеть ссылку не тратит, а экран вёл только на
  // «Запросить новую». «Повторить» шлёт тот же токен из памяти страницы.
  it('нет связи → «Нет связи» и «Повторить» тем же токеном; токена в адресе нет', async () => {
    let calls = 0;
    fetchMock.mockImplementation((url: string) => {
      if (!String(url).endsWith('/email/consume')) return Promise.resolve(json(401, {}));
      calls += 1;
      return calls === 1 ? Promise.reject(new TypeError('Failed to fetch')) : Promise.resolve(consumeReply);
    });
    renderPage('?email_token=raw-1');
    const retry = await screen.findByRole('button', { name: 'Повторить' });
    expect(screen.getByText(/Ссылка из письма ещё действует/)).toBeTruthy();
    expect(window.location.href).not.toContain('raw-1');
    fireEvent.click(retry);
    await screen.findByText('at:/account?linked=email');
    expect(consumeCalls().map((c) => JSON.parse(c[1].body))).toEqual([{ token: 'raw-1' }, { token: 'raw-1' }]);
  });

  it('сбой сервера (502) — тоже повтор на месте; просрочка — нет (контроль)', async () => {
    consumeReply = json(502, {});
    renderPage('?email_token=raw-1');
    expect(await screen.findByRole('button', { name: 'Повторить' })).toBeTruthy();
    cleanup();
    consumeReply = json(401, { message: 'Token expired' });
    renderPage('?email_token=raw-2');
    await screen.findByText('at:/auth/error?reason=email_link_expired');
  });

  it('контрольный: без ?email_token POST не уходит (это обычный OAuth-колбэк)', async () => {
    renderPage('');
    await waitFor(() =>
      expect(screen.getByText(/at:\/login\?error=no_token/)).toBeTruthy(),
    );
    expect(consumeCalls()).toHaveLength(0);
  });
});

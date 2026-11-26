// @vitest-environment jsdom
// Тест на шве (правило №14), баг 2026-11: повтор после refresh уходил со
// старым токеном. authedFetch на 401 зовёт refresh и СРАЗУ повторяет запрос, а
// TokenBridge отдавал api-клиенту замыкание на state — новый токен доезжал
// только с рендером, повтор шёл со старым → снова 401 → «Не удалось
// загрузить/сохранить» у каждого, кто вернулся в PWA через 15+ минут.
// Здесь настоящие AuthProvider + TokenBridge + authedFetch, мок — только fetch.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { AuthProvider } from './AuthProvider';
import { TokenBridge } from './TokenBridge';
import { useAuth } from './authContext';
import { resetRefreshLockForTests } from './refreshSession';
import { authedFetch } from '../apiClient';
import { clearApiCache } from '../../../shared/src/api/apiCache';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

let fetchMock: ReturnType<typeof vi.fn>;
let refreshTokens: string[];
let xReplies: number[];

beforeEach(() => {
  resetRefreshLockForTests();
  clearApiCache();
  localStorage.clear();
  refreshTokens = ['t1', 't2'];
  xReplies = [401, 200];
  fetchMock = vi.fn((url: string) => {
    const u = String(url);
    if (u.endsWith('/api/auth/refresh')) {
      return Promise.resolve(json(200, { accessToken: refreshTokens.shift(), expiresIn: 900 }));
    }
    if (u.endsWith('/api/x')) return Promise.resolve(json(xReplies.shift() ?? 500, { ok: true }));
    return Promise.resolve(json(404, {}));
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  resetRefreshLockForTests();
});

function Probe() {
  const { accessToken } = useAuth();
  return <div>tok:{accessToken ?? 'none'}</div>;
}

const authHeaderOf = (call: unknown[]) =>
  ((call[1] as RequestInit).headers as Record<string, string>).Authorization;

describe('TokenBridge → authedFetch: повтор после refresh', () => {
  it('повтор на 401 уходит с НОВЫМ токеном, а не со старым', async () => {
    render(
      <AuthProvider>
        <TokenBridge />
        <Probe />
      </AuthProvider>,
    );
    // Загрузка: Telegram-обмена в jsdom нет → refresh по куке даёт t1.
    await screen.findByText('tok:t1');

    const res = await authedFetch('/api/x');

    expect(res.status).toBe(200);
    const xCalls = fetchMock.mock.calls.filter((c) => String(c[0]).endsWith('/api/x'));
    expect(xCalls).toHaveLength(2);
    expect(authHeaderOf(xCalls[0])).toBe('Bearer t1');
    expect(authHeaderOf(xCalls[1])).toBe('Bearer t2');
  });
});

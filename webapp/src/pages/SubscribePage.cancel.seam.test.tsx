// @vitest-environment jsdom
// Шов отмены подписки (frontends#0, аудит 2026-10-11; правило №14): настоящий
// SubscribePage → настоящий api.ts → настоящий apiClient.postJson, подменён
// только fetch. Юнит-тесты с моком api.cancelSubscription не видят, что
// происходит, когда сервер отвечает 200 со страницей техработ вместо JSON
// (deploy/front-server.mjs в окно деплоя): отказ приходит не как ApiError, а
// как SyntaxError из разбора тела, и раньше его глотал `catch { /* ignore */ }`.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SubscribePage } from './SubscribePage';

const MAINTENANCE_HTML = readFileSync(resolve(__dirname, '../../../deploy/maintenance.html'), 'utf8');
const ACTIVE = JSON.stringify({ status: 'active', period: 'month', amount: 299, nextChargeAt: '2026-11-01T00:00:00Z' });

const resp = (status: number, text: string): Response =>
  ({ ok: status >= 200 && status < 300, status, text: () => Promise.resolve(text), json: () => Promise.resolve(JSON.parse(text)), headers: new Headers() } as unknown as Response);

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  window.history.pushState({}, '', '/subscribe?token=tok1');
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.pushState({}, '', '/');
});

async function clickCancel(cancelAnswer: Response | Error) {
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.includes('/api/subscription/options')) return Promise.resolve(resp(200, JSON.stringify({ enabled: true, options: [] })));
    if (u.includes('/api/subscription/by-token/')) return Promise.resolve(resp(200, ACTIVE));
    if (u.includes('/api/subscription/cancel/') && init?.method === 'POST') {
      return cancelAnswer instanceof Error ? Promise.reject(cancelAnswer) : Promise.resolve(cancelAnswer);
    }
    return Promise.resolve(resp(204, ''));
  });
  render(<SubscribePage />);
  await screen.findByText(/Следующее списание/);
  fireEvent.click(screen.getByRole('button', { name: 'Отменить подписку' }));
}

const cancelPosts = () =>
  fetchMock.mock.calls.filter(([u, i]) => String(u).includes('/api/subscription/cancel/tok1') && i?.method === 'POST');
const reports = () => fetchMock.mock.calls.filter(([u]) => String(u).includes('/api/client-error'));

describe('SubscribePage — шов отмены подписки через настоящий apiClient', () => {
  it('контроль: 200 {ok:true} → «Подписка отменена», отчёта нет', async () => {
    await clickCancel(resp(200, JSON.stringify({ ok: true })));
    await screen.findByText('Подписка отменена');
    expect(cancelPosts()).toHaveLength(1);
    expect(reports()).toHaveLength(0);
  });

  it('окно деплоя: 200 с HTML техработ вместо JSON → ошибка, а не «отменено»; отчёт ушёл', async () => {
    await clickCancel(resp(200, MAINTENANCE_HTML));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/Не получилось отменить подписку/);
    expect(screen.queryByText('Подписка отменена')).toBeNull();
    expect((screen.getByRole('button', { name: 'Отменить подписку' }) as HTMLButtonElement).disabled).toBe(false);
    expect(cancelPosts()).toHaveLength(1);
    expect(reports()).toHaveLength(1);
    const body = JSON.parse(String(reports()[0][1]?.body));
    expect(body.section).toBe('subscription');
    expect(JSON.stringify(body)).not.toContain('tok1');
  });

  it.each([
    ['500', () => resp(500, JSON.stringify({ message: 'Internal server error' }))],
    ['429 троттлера', () => resp(429, JSON.stringify({ message: 'ThrottlerException: Too Many Requests' }))],
    ['обрыв сети', () => new TypeError('Failed to fetch')],
  ])('%s → ошибка видна, «Подписка отменена» нет', async (_name, answer) => {
    await clickCancel(answer());
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/Не получилось отменить подписку/);
    expect(screen.queryByText('Подписка отменена')).toBeNull();
  });

  it('404 → «ссылка устарела», отчёта нет', async () => {
    await clickCancel(resp(404, JSON.stringify({ message: 'Subscription not found' })));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/Ссылка устарела/);
    expect(reports()).toHaveLength(0);
  });
});

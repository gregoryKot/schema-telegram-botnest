// @vitest-environment jsdom
// «Сохранил → нашёл»: подписка на пуши меняет notifyChannel в GET
// /api/settings, а GET кешируется на 15 секунд (shared/src/api/apiCache.ts).
// Без строки в карте мутаций (apiCacheRules.data.ts) лист настроек после
// включения перечитал бы старый канал — «Пока не приходят» висело бы дальше.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { api } from '../api';
import { pushApi } from './pushApi';
import { clearApiCache } from '../../../shared/src/api/apiCache';

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

function stubServer() {
  let channel: 'push' | 'telegram' | null = null;
  const known = new Set<string>();
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const path = new URL(url, 'https://schemehappens.ru').pathname;
    const endpoint = init?.body ? String((JSON.parse(String(init.body)) as { endpoint?: unknown }).endpoint) : '';
    if (path === '/api/settings') return json({ notifyChannel: channel, notifyReachable: channel !== null });
    if (path === '/api/push/subscription' && init?.method === 'POST') {
      channel = 'push';
      known.add(endpoint);
      return json({ ok: true, delivered: true });
    }
    if (path === '/api/push/unsubscribe' && init?.method === 'POST') {
      channel = null;
      known.delete(endpoint);
      return json({ ok: true });
    }
    if (path === '/api/push/status' && init?.method === 'POST') return json({ known: known.has(endpoint) });
    return new Response('not found', { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  clearApiCache();
});

describe('pushApi ↔ кеш настроек', () => {
  it('подписался → перечитанные настройки уже с каналом push', async () => {
    stubServer();
    expect((await api.getSettings()).notifyChannel).toBeNull();
    const res = await pushApi.subscribe({ endpoint: 'https://fcm.googleapis.com/fcm/send/x', keys: { p256dh: 'p', auth: 'a' } });
    expect(res).toEqual({ ok: true, delivered: true });
    expect((await api.getSettings()).notifyChannel).toBe('push');
  });

  it('отписался → перечитанные настройки без канала', async () => {
    stubServer();
    await pushApi.subscribe({ endpoint: 'https://fcm.googleapis.com/fcm/send/x', keys: { p256dh: 'p', auth: 'a' } });
    expect((await api.getSettings()).notifyChannel).toBe('push');
    await pushApi.unsubscribe('https://fcm.googleapis.com/fcm/send/x', 'user');
    expect((await api.getSettings()).notifyChannel).toBeNull();
  });

  it('отписка шлёт endpoint и причину ровно по контракту', async () => {
    const fetchMock = stubServer();
    await pushApi.unsubscribe('https://e', 'logout');
    const [, init] = fetchMock.mock.calls.find(([u]) => String(u).endsWith('/api/push/unsubscribe'))!;
    expect(JSON.parse(String(init?.body))).toEqual({ endpoint: 'https://e', reason: 'logout' });
  });

  it('сверка адреса: endpoint в теле POST, не в URL; после подписки — known, после отписки — нет (ответ не из кеша)', async () => {
    const fetchMock = stubServer();
    const endpoint = 'https://fcm.googleapis.com/fcm/send/x';
    expect(await pushApi.status(endpoint)).toEqual({ known: false });
    await pushApi.subscribe({ endpoint, keys: { p256dh: 'p', auth: 'a' } });
    expect(await pushApi.status(endpoint)).toEqual({ known: true });
    await pushApi.unsubscribe(endpoint, 'user');
    expect(await pushApi.status(endpoint)).toEqual({ known: false });
    const calls = fetchMock.mock.calls.filter(([u]) => String(u).includes('/api/push/status'));
    expect(calls).toHaveLength(3);
    for (const [url, init] of calls) {
      expect(String(url)).not.toContain('fcm.googleapis.com');
      expect(init?.method).toBe('POST');
      expect(JSON.parse(String(init?.body))).toEqual({ endpoint });
    }
  });
});

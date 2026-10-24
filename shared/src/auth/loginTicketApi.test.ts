// Сетевая половина билета. Главное здесь — `credentials: 'include'`: именно в
// ЭТОТ контейнер сервер кладёт refresh-куку, когда вход подтвердят. Без него
// весь механизм бессмыслен — сессия снова осталась бы там, где подтверждали.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLoginTicketApi } from './loginTicketApi';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

function ok(body: unknown) {
  return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
}

describe('createLoginTicketApi', () => {
  it('start уходит на свой роут с намерением и площадкой', async () => {
    fetchMock.mockReturnValue(
      ok({
        deviceCode: 'd',
        userCode: 'K7M2QX94',
        expiresIn: 300,
        interval: 3,
      }),
    );
    const api = createLoginTicketApi('');

    const res = await api.start({
      intent: 'login',
      provider: 'telegram',
      hostId: 'web',
    });

    expect(res.userCode).toBe('K7M2QX94');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/auth/ticket/start');
    expect(init.credentials).toBe('include');
    expect(init.headers['x-requested-with']).toBe('ticket');
    expect(JSON.parse(init.body)).toEqual({
      intent: 'login',
      provider: 'telegram',
      hostId: 'web',
    });
  });

  it('poll шлёт длинный секрет и получает статус', async () => {
    fetchMock.mockReturnValue(ok({ status: 'pending' }));
    const api = createLoginTicketApi('');

    expect(await api.poll('d'.repeat(64))).toEqual({ status: 'pending' });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      deviceCode: 'd'.repeat(64),
    });
  });

  it('свой apiBase уважается — фронт может жить на другом origin', async () => {
    fetchMock.mockReturnValue(ok({ status: 'pending' }));
    await createLoginTicketApi('https://api.example').poll('x');
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.example/api/auth/ticket/poll',
    );
  });

  it('плохой ответ — исключение, а не молчаливое «всё хорошо»', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 429 });
    await expect(createLoginTicketApi('').poll('x')).rejects.toThrow(
      'HTTP 429',
    );
  });
});

// @vitest-environment jsdom
// Клиентская половина привязки аккаунта (RFC 8628).
//
// Главное: опрос обязан ЗАВЕРШАТЬСЯ. Цикл, который крутится вечно, съедает
// батарею телефона и остаётся висеть после того, как человек закрыл настройки.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { linkUrl, pollLink, type LinkStart } from './deviceLink';
import { adoptSession } from '../session';

vi.mock('../session', () => ({ adoptSession: vi.fn() }));
vi.mock('../apiClient', () => ({ authedFetch: vi.fn() }));

const START: LinkStart = {
  deviceCode: 'd'.repeat(64),
  userCode: 'ABCD2345',
  expiresIn: 300,
  interval: 3,
};

function jsonResponse(body: unknown): Response {
  return { ok: true, json: () => Promise.resolve(body) } as unknown as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;
// Ожидание подменяем: настоящие паузы превратили бы тест в трёхминутный.
const noWait = () => Promise.resolve();

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('linkUrl', () => {
  it('ведёт на страницу подтверждения с кодом в адресе', () => {
    expect(linkUrl('ABCD2345')).toContain('/link?code=ABCD2345');
  });

  it('код экранируется — адрес не ломается на неожиданном символе', () => {
    expect(linkUrl('A B&C')).toContain('code=A%20B%26C');
  });
});

describe('pollLink', () => {
  it('дожидается подтверждения и принимает сессию целевого аккаунта', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ status: 'pending' }))
      .mockResolvedValueOnce(jsonResponse({ status: 'pending' }))
      .mockResolvedValueOnce(
        jsonResponse({ status: 'linked', accessToken: 'a1', expiresIn: 900 }),
      );

    await expect(pollLink(START, { wait: noWait })).resolves.toBe('linked');
    expect(adoptSession).toHaveBeenCalledWith('a1', 900);
  });

  it('сервер сказал «протух» — прекращает сразу, не дожидаясь срока', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ status: 'expired' }));

    await expect(pollLink(START, { wait: noWait })).resolves.toBe('expired');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(adoptSession).not.toHaveBeenCalled();
  });

  it('срок вышел, а подтверждения нет — цикл останавливается', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ status: 'pending' }));
    // Время идёт быстрее опроса: третий проход уже за сроком.
    let t = 0;
    const now = () => (t += 150_000);

    await expect(pollLink(START, { wait: noWait, now })).resolves.toBe(
      'expired',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('ответ без токена не принимается за успех', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ status: 'linked' }))
      .mockResolvedValueOnce(jsonResponse({ status: 'expired' }));

    await expect(pollLink(START, { wait: noWait })).resolves.toBe('expired');
    expect(adoptSession).not.toHaveBeenCalled();
  });

  it('сетевой сбой посреди ожидания не роняет опрос — пробует снова', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 502 })
      .mockResolvedValueOnce(
        jsonResponse({ status: 'linked', accessToken: 'a2', expiresIn: 900 }),
      );

    await expect(pollLink(START, { wait: noWait })).resolves.toBe('linked');
    expect(adoptSession).toHaveBeenCalledWith('a2', 900);
  });

  it('опрашивает длинным кодом, а не тем, что видит человек', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ status: 'expired' }));

    await pollLink(START, { wait: noWait });

    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    ) as { deviceCode: string };
    expect(body.deviceCode).toBe(START.deviceCode);
    expect(JSON.stringify(body)).not.toContain(START.userCode);
  });
});

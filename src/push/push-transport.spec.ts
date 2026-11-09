// Таблица исходов одной отправки (push-transport.ts): от неё зависит, удалит
// ли сервис подписку, пометит ли очередь строку отправленной и будет ли повтор.
import { WebPushError, generateVAPIDKeys } from 'web-push';
import {
  attemptPush,
  classifyPushError,
  PUSH_TIMEOUT_MS,
  PUSH_TTL_S,
  type SendFn,
} from './push-transport';

const keys = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/x',
  p256dh: 'p',
  auth: 'a',
};
const vapid = { ...generateVAPIDKeys(), subject: 'https://schemehappens.ru' };
const webPushError = (status: number) =>
  new WebPushError(
    'Received unexpected response code',
    status,
    {},
    '',
    keys.endpoint,
  );

describe('classifyPushError', () => {
  it.each([404, 410, 401, 403])(
    'HTTP %i → gone (подписки нет или не наша)',
    (s) => {
      expect(classifyPushError(webPushError(s))).toBe('gone');
    },
  );

  it.each([400, 413, 429, 500, 503])(
    'HTTP %i → failed (подписка жива)',
    (s) => {
      expect(classifyPushError(webPushError(s))).toBe('failed');
    },
  );

  it('таймаут сокета → unknown (сервис мог принять)', () => {
    expect(classifyPushError(new Error('Socket timeout'))).toBe('unknown');
  });

  it('сеть → failed', () => {
    const err = Object.assign(new Error('connect ECONNREFUSED'), {
      code: 'ECONNREFUSED',
    });
    expect(classifyPushError(err)).toBe('failed');
  });
});

describe('attemptPush', () => {
  it('2xx → accepted; опции: VAPID, сутки TTL, normal, таймаут 10 с', async () => {
    const send = jest
      .fn()
      .mockResolvedValue({ statusCode: 201, body: '', headers: {} });
    const res = await attemptPush(send, keys, '{}', vapid);
    expect(res).toEqual({ result: 'accepted', status: 201 });
    expect(send).toHaveBeenCalledWith(
      { endpoint: keys.endpoint, keys: { p256dh: 'p', auth: 'a' } },
      '{}',
      {
        vapidDetails: vapid,
        TTL: PUSH_TTL_S,
        urgency: 'normal',
        timeout: PUSH_TIMEOUT_MS,
      },
    );
    expect(PUSH_TTL_S).toBe(86_400);
    expect(PUSH_TIMEOUT_MS).toBe(10_000);
  });

  it('410 → gone со статусом; бросок не выходит наружу', async () => {
    const send = jest.fn().mockRejectedValue(webPushError(410));
    await expect(attemptPush(send, keys, '{}', vapid)).resolves.toEqual({
      result: 'gone',
      status: 410,
    });
  });

  it('ответ не пришёл за предел — unknown, поздний отказ не всплывает', async () => {
    jest.useFakeTimers();
    try {
      let reject: (e: Error) => void = () => undefined;
      const send = jest.fn(
        () => new Promise((_, rej) => (reject = rej)),
      ) as unknown as SendFn;
      const pending = attemptPush(send, keys, '{}', vapid, 50);
      jest.advanceTimersByTime(60);
      await expect(pending).resolves.toEqual({
        result: 'unknown',
        status: null,
      });
      reject(new Error('поздний обрыв'));
    } finally {
      jest.useRealTimers();
    }
  });
});

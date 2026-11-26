import { generateVAPIDKeys } from 'web-push';
import { webPushProbe, WEB_PUSH_PROBE_URL } from './probe-web-push';

const keys = generateVAPIDKeys();
const env = {
  VAPID_PUBLIC_KEY: keys.publicKey,
  VAPID_PRIVATE_KEY: keys.privateKey,
};

describe('webPushProbe', () => {
  it('ключей нет — «выключено», запросов нет', async () => {
    const fetchFn = jest.fn();
    await expect(webPushProbe({}, fetchFn).run()).resolves.toEqual({
      ok: true,
      detail: 'выключено',
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('половина пары — авария с причиной, без запроса', async () => {
    const fetchFn = jest.fn();
    const res = await webPushProbe(
      { VAPID_PUBLIC_KEY: keys.publicKey },
      fetchFn,
    ).run();
    expect(res.ok).toBe(false);
    expect(res.detail).toContain('VAPID_PRIVATE_KEY');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('ключи верны, FCM ответил любым HTTP — в порядке; запрос с таймаутом', async () => {
    const fetchFn = jest.fn().mockResolvedValue({ status: 404 });
    const res = await webPushProbe(env, fetchFn).run();
    expect(res).toEqual({
      ok: true,
      detail: expect.stringContaining('HTTP 404'),
    });
    expect(fetchFn).toHaveBeenCalledWith(
      WEB_PUSH_PROBE_URL,
      expect.objectContaining({
        method: 'HEAD',
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it('сеть упала — авария, проба не бросает', async () => {
    const fetchFn = jest.fn().mockRejectedValue(new Error('connect ETIMEDOUT'));
    const res = await webPushProbe(env, fetchFn).run();
    expect(res).toEqual({
      ok: false,
      detail: expect.stringContaining('ETIMEDOUT'),
    });
  });

  it('в /health не идёт, повтор после вспышки связи есть', () => {
    const probe = webPushProbe({});
    expect(probe.reportInHealth).toBe(false);
    expect(probe.retryOnce).toBe(true);
  });
});

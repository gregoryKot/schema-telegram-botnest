// @vitest-environment jsdom
// Включение, выключение и отписка при выходе (pushSubscription.ts) — через
// подставной браузер (pushBrowser.test-helpers.ts) и настоящий код модуля.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { api } from '../api';
import { pushApi } from './pushApi';
import {
  disablePush, dropPushAfterAccountDeletion, enablePush, releasePushOnLogout, sameServerKey, subscriptionBody,
} from './pushSubscription';
import { installPushBrowser, removePushBrowser } from './pushBrowser.test-helpers';
import { PUSH_DENIED_EVENT } from '../../../shared/src/share/analytics';

// Ключ VAPID: 65 байт несжатой точки P-256 (первый байт 0x04), base64url.
const KEY_BYTES = new Uint8Array(65).map((_, i) => (i === 0 ? 4 : i));
const KEY = btoa(String.fromCharCode(...KEY_BYTES)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

let track: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  track = vi.spyOn(api, 'trackEvent').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  removePushBrowser();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('enablePush — только по клику, разрешение → воркер → подписка → сервер', () => {
  it('разрешили — воркер /sw.js на весь сайт, подписка с ключом сервера, тело на сервер', async () => {
    const b = installPushBrowser({ answer: 'granted' });
    const subscribe = vi.spyOn(pushApi, 'subscribe').mockResolvedValue({ ok: true, delivered: true });
    expect(await enablePush(KEY)).toEqual({ kind: 'on', delivered: true });
    expect(b.notification.requestPermission).toHaveBeenCalledTimes(1);
    expect(b.serviceWorker.register).toHaveBeenCalledWith('/sw.js', { scope: '/' });
    const opts = b.pushManager.subscribe.mock.calls[0][0];
    expect(opts.userVisibleOnly).toBe(true);
    expect([...opts.applicationServerKey]).toEqual([...KEY_BYTES]);
    expect(subscribe).toHaveBeenCalledWith({
      endpoint: 'https://fcm.googleapis.com/fcm/send/new',
      keys: { p256dh: 'P256DH', auth: 'AUTH' },
    });
  });

  it('пробный пуш не дошёл — включено, delivered: false', async () => {
    installPushBrowser();
    vi.spyOn(pushApi, 'subscribe').mockResolvedValue({ ok: true, delivered: false });
    expect(await enablePush(KEY)).toEqual({ kind: 'on', delivered: false });
  });

  it('запретили — событие push_denied, воркер не регистрируется', async () => {
    const b = installPushBrowser({ answer: 'denied' });
    expect(await enablePush(KEY)).toEqual({ kind: 'denied' });
    expect(track).toHaveBeenCalledWith(PUSH_DENIED_EVENT);
    expect(PUSH_DENIED_EVENT).toBe('push_denied');
    expect(b.serviceWorker.register).not.toHaveBeenCalled();
  });

  it('закрыли окно, не ответив — ничего не происходит и событие не шлётся', async () => {
    const b = installPushBrowser({ answer: 'default' });
    expect(await enablePush(KEY)).toEqual({ kind: 'dismissed' });
    expect(track).not.toHaveBeenCalled();
    expect(b.serviceWorker.register).not.toHaveBeenCalled();
  });

  it.each([
    ['сеть', new TypeError('Failed to fetch')],
    ['400 — чужой push-сервис', Object.assign(new Error('Bad Request'), { status: 400 })],
    ['503 — VAPID не настроен', Object.assign(new Error('Unavailable'), { status: 503 })],
  ])('сервер не принял (%s) — ошибка, и браузерная подписка снята: «включено» не врёт', async (_n, err) => {
    const b = installPushBrowser();
    vi.spyOn(pushApi, 'subscribe').mockRejectedValue(err);
    expect(await enablePush(KEY)).toEqual({ kind: 'error' });
    expect(b.subscription).toBeNull();
  });

  it('старая подписка тем же ключом — переиспользуется, новая не делается', async () => {
    const b = installPushBrowser({ subscription: true, subscriptionKey: KEY_BYTES });
    vi.spyOn(pushApi, 'subscribe').mockResolvedValue({ ok: true, delivered: true });
    await enablePush(KEY);
    expect(b.pushManager.subscribe).not.toHaveBeenCalled();
  });

  it('старая подписка другим ключом (ключ сервера сменили) — снимается и делается новая', async () => {
    const b = installPushBrowser({ subscription: true, subscriptionKey: new Uint8Array([4, 9, 9]) });
    const old = b.subscription!;
    vi.spyOn(pushApi, 'subscribe').mockResolvedValue({ ok: true, delivered: true });
    await enablePush(KEY);
    expect(old.unsubscribe).toHaveBeenCalled();
    expect(b.pushManager.subscribe).toHaveBeenCalled();
  });
});

describe('disablePush — по тумблеру', () => {
  it('сервер забывает подписку (reason user), потом снимается браузерная', async () => {
    const b = installPushBrowser({ subscription: true });
    const sub = b.subscription!;
    const unsubscribe = vi.spyOn(pushApi, 'unsubscribe').mockResolvedValue(undefined);
    await disablePush();
    expect(unsubscribe).toHaveBeenCalledWith('https://fcm.googleapis.com/fcm/send/old', 'user');
    expect(sub.unsubscribe).toHaveBeenCalled();
    expect(b.subscription).toBeNull();
  });

  it('сервер не ответил — ошибка наружу, подписка в браузере остаётся (уведомления идут)', async () => {
    const b = installPushBrowser({ subscription: true });
    vi.spyOn(pushApi, 'unsubscribe').mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(disablePush()).rejects.toThrow('Failed to fetch');
    expect(b.subscription).not.toBeNull();
  });
});

describe('releasePushOnLogout — выход не оставляет чужих напоминаний', () => {
  it('подписка есть — сервер забывает её с reason logout, браузерная снята', async () => {
    const b = installPushBrowser({ subscription: true });
    const unsubscribe = vi.spyOn(pushApi, 'unsubscribe').mockResolvedValue(undefined);
    await releasePushOnLogout();
    expect(unsubscribe).toHaveBeenCalledWith('https://fcm.googleapis.com/fcm/send/old', 'logout');
    expect(b.subscription).toBeNull();
  });

  it('сеть легла — выход не падает, браузерная подписка всё равно снята', async () => {
    const b = installPushBrowser({ subscription: true });
    vi.spyOn(pushApi, 'unsubscribe').mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(releasePushOnLogout()).resolves.toBeUndefined();
    expect(b.subscription).toBeNull();
  });

  it('сервер висит — выход ждёт не дольше 5 секунд', async () => {
    vi.useFakeTimers();
    const b = installPushBrowser({ subscription: true });
    vi.spyOn(pushApi, 'unsubscribe').mockReturnValue(new Promise<void>(() => undefined));
    const done = releasePushOnLogout();
    await vi.advanceTimersByTimeAsync(5_000);
    await expect(done).resolves.toBeUndefined();
    expect(b.subscription).toBeNull();
  });

  it('подписки нет или браузер без пушей — ни одного запроса', async () => {
    const unsubscribe = vi.spyOn(pushApi, 'unsubscribe');
    await releasePushOnLogout();
    installPushBrowser();
    await releasePushOnLogout();
    expect(unsubscribe).not.toHaveBeenCalled();
  });
});

describe('dropPushAfterAccountDeletion', () => {
  it('сервер уже стёр подписки вместе с аккаунтом — снимается только браузерная, без запроса', async () => {
    const b = installPushBrowser({ subscription: true });
    const unsubscribe = vi.spyOn(pushApi, 'unsubscribe');
    await dropPushAfterAccountDeletion();
    expect(unsubscribe).not.toHaveBeenCalled();
    expect(b.subscription).toBeNull();
  });
});

describe('subscriptionBody / sameServerKey', () => {
  const sub = (json: unknown, key: ArrayBuffer | null = null) =>
    ({ toJSON: () => json, options: { applicationServerKey: key } }) as unknown as PushSubscription;

  it('подписка без ключей — null (сервер такую не примет)', () => {
    expect(subscriptionBody(sub({ endpoint: 'https://x' }))).toBeNull();
    expect(subscriptionBody(sub({ keys: { p256dh: 'a', auth: 'b' } }))).toBeNull();
    expect(subscriptionBody(sub({ endpoint: 'https://x', keys: { p256dh: 'a', auth: 'b' } }))).toEqual({
      endpoint: 'https://x', keys: { p256dh: 'a', auth: 'b' },
    });
  });

  it('ключ сравнивается побайтно', () => {
    expect(sameServerKey(sub({}, new Uint8Array([4, 1, 2]).buffer), new Uint8Array([4, 1, 2]))).toBe(true);
    expect(sameServerKey(sub({}, new Uint8Array([4, 1, 3]).buffer), new Uint8Array([4, 1, 2]))).toBe(false);
    expect(sameServerKey(sub({}, null), new Uint8Array([4]))).toBe(false);
  });
});

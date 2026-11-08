// @vitest-environment jsdom
// Состояние веб-пушей на устройстве (pushState.ts): что показать в строке
// «На этом устройстве» — от вебвью мессенджера до живой подписки.
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  currentPushSubscription, hasPushApis, preliminaryPushState, pushDeviceState, readPushEnv, reconcilePushState,
  type PushEnv,
} from './pushState';
import { installPushBrowser, removePushBrowser } from './pushBrowser.test-helpers';
import { installTelegram, removeTelegram } from '../host/tgStub.test-helpers';

afterEach(() => {
  removePushBrowser();
  removeTelegram();
  vi.restoreAllMocks();
});

const env = (over: Partial<PushEnv> = {}): PushEnv => ({
  hostId: 'web', platform: 'android', standalone: false, apis: true, permission: 'default', ...over,
});

describe('pushDeviceState — чистое решение', () => {
  it('нет ключа VAPID на сервере — «не поддерживается», даже в идеальном браузере', () => {
    expect(pushDeviceState(env(), null, true)).toBe('unsupported');
  });

  it('вебвью Telegram/MAX — «не поддерживается», даже если API есть', () => {
    expect(pushDeviceState(env({ hostId: 'telegram' }), 'KEY', false)).toBe('unsupported');
    expect(pushDeviceState(env({ hostId: 'max' }), 'KEY', false)).toBe('unsupported');
  });

  it('iPhone во вкладке Safari — «установи на экран»: PushManager там нет, но после установки пуши работают', () => {
    expect(pushDeviceState(env({ platform: 'ios', apis: false }), 'KEY', false)).toBe('ios-install');
  });

  it('iPhone с экрана «Домой» — обычный путь: off/on', () => {
    expect(pushDeviceState(env({ platform: 'ios', standalone: true }), 'KEY', false)).toBe('off');
    expect(pushDeviceState(env({ platform: 'ios', standalone: true }), 'KEY', true)).toBe('on');
  });

  it('iPhone на старой iOS с экрана «Домой» — API нет: «не поддерживается»', () => {
    expect(pushDeviceState(env({ platform: 'ios', standalone: true, apis: false }), 'KEY', false)).toBe('unsupported');
  });

  it('старый браузер без PushManager — «не поддерживается»', () => {
    expect(pushDeviceState(env({ apis: false }), 'KEY', false)).toBe('unsupported');
  });

  it('запрещено в браузере — denied, даже если подписка осталась', () => {
    expect(pushDeviceState(env({ permission: 'denied' }), 'KEY', true)).toBe('denied');
  });

  it('разрешено или не спрошено — по подписке', () => {
    expect(pushDeviceState(env({ permission: 'granted' }), 'KEY', false)).toBe('off');
    expect(pushDeviceState(env({ permission: 'granted' }), 'KEY', true)).toBe('on');
    expect(pushDeviceState(env({ permission: 'default' }), 'KEY', false)).toBe('off');
  });

  it('preliminaryPushState — без ключа ясно только «не поддерживается» и «установи»', () => {
    expect(preliminaryPushState(env({ hostId: 'max' }))).toBe('unsupported');
    expect(preliminaryPushState(env({ apis: false }))).toBe('unsupported');
    expect(preliminaryPushState(env({ platform: 'ios' }))).toBe('ios-install');
    expect(preliminaryPushState(env())).toBeNull();
  });
});

describe('reconcilePushState — сверка с каналом сервера', () => {
  it('on при канале push — on; при telegram или null сервер подписку забыл — off', () => {
    expect(reconcilePushState('on', 'push')).toBe('on');
    expect(reconcilePushState('on', 'telegram')).toBe('off');
    expect(reconcilePushState('on', null)).toBe('off');
  });

  it('остальные состояния не трогает', () => {
    for (const s of ['off', 'denied', 'ios-install', 'unsupported', null] as const) {
      expect(reconcilePushState(s, null)).toBe(s);
    }
  });
});

describe('readPushEnv / hasPushApis — снимок настоящего окружения', () => {
  it('jsdom без serviceWorker и PushManager — API нет, разрешение не читается', () => {
    expect(hasPushApis()).toBe(false);
    expect(readPushEnv()).toMatchObject({ hostId: 'web', apis: false, permission: null });
  });

  it('браузер с API — разрешение из Notification.permission', () => {
    installPushBrowser({ permission: 'denied' });
    expect(readPushEnv()).toMatchObject({ hostId: 'web', apis: true, permission: 'denied' });
  });

  it('внутри Telegram — hostId telegram (настоящий детектор хоста)', () => {
    installTelegram();
    expect(readPushEnv().hostId).toBe('telegram');
  });
});

describe('currentPushSubscription — подписка этого браузера', () => {
  it('без API — null, ничего не регистрирует', async () => {
    expect(await currentPushSubscription()).toBeNull();
  });

  it('регистрации нет — null; воркер при этом не регистрируется', async () => {
    const b = installPushBrowser({ registered: false });
    expect(await currentPushSubscription()).toBeNull();
    expect(b.serviceWorker.getRegistration).toHaveBeenCalledWith('/');
    expect(b.serviceWorker.register).not.toHaveBeenCalled();
  });

  it('есть регистрация и подписка — подписка', async () => {
    const b = installPushBrowser({ subscription: true });
    expect(await currentPushSubscription()).toBe(b.subscription);
  });

  it('браузер бросил при чтении — null, а не падение экрана', async () => {
    const b = installPushBrowser();
    b.serviceWorker.getRegistration.mockRejectedValueOnce(new Error('SecurityError'));
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(await currentPushSubscription()).toBeNull();
  });
});

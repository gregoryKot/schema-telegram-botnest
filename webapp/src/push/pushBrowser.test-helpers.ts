// Только для тестов: подставной браузер с веб-пушами — navigator.serviceWorker,
// PushManager и Notification с состоянием (регистрация, подписка, разрешение),
// чтобы модуль подписки проходил настоящим кодом через «браузер», а не мимо него.
import { vi } from 'vitest';

const DEFAULT_ENDPOINT = 'https://fcm.googleapis.com/fcm/send/old';
const NEW_ENDPOINT = 'https://fcm.googleapis.com/fcm/send/new';

export interface FakeSubscription {
  endpoint: string;
  options: { applicationServerKey: ArrayBuffer | null };
  toJSON: () => { endpoint: string; keys: { p256dh: string; auth: string } };
  unsubscribe: ReturnType<typeof vi.fn>;
}

interface Options {
  /** Notification.permission на старте. */
  permission?: NotificationPermission;
  /** Что ответит окно requestPermission. */
  answer?: NotificationPermission;
  /** Воркер уже зарегистрирован (по умолчанию — да, если есть подписка). */
  registered?: boolean;
  /** Подписка уже есть. */
  subscription?: boolean;
  /** Ключ сервера, которым сделана существующая подписка. */
  subscriptionKey?: Uint8Array;
}

export function installPushBrowser(o: Options = {}) {
  let registered = o.registered ?? !!o.subscription;
  let current: FakeSubscription | null = null;
  const makeSub = (endpoint: string, key: Uint8Array | null): FakeSubscription => {
    const sub: FakeSubscription = {
      endpoint,
      options: { applicationServerKey: key ? new Uint8Array(key).buffer : null },
      toJSON: () => ({ endpoint, keys: { p256dh: 'P256DH', auth: 'AUTH' } }),
      unsubscribe: vi.fn(async () => {
        if (current === sub) current = null;
        return true;
      }),
    };
    return sub;
  };
  if (o.subscription) current = makeSub(DEFAULT_ENDPOINT, o.subscriptionKey ?? null);
  const pushManager = {
    getSubscription: vi.fn(async () => current),
    subscribe: vi.fn(async (opts: { applicationServerKey: Uint8Array }) => {
      current = makeSub(NEW_ENDPOINT, opts.applicationServerKey);
      return current;
    }),
  };
  const registration = { pushManager };
  const serviceWorker = {
    register: vi.fn(async () => {
      registered = true;
      return registration;
    }),
    getRegistration: vi.fn(async () => (registered ? registration : undefined)),
    ready: Promise.resolve(registration),
  };
  const notification = {
    permission: o.permission ?? 'default',
    requestPermission: vi.fn(async () => {
      notification.permission = o.answer ?? 'granted';
      return notification.permission;
    }),
  };
  Object.defineProperty(navigator, 'serviceWorker', { value: serviceWorker, configurable: true });
  vi.stubGlobal('PushManager', function PushManager() {});
  vi.stubGlobal('Notification', notification);
  return {
    serviceWorker,
    pushManager,
    notification,
    get subscription() {
      return current;
    },
  };
}

export function removePushBrowser(): void {
  delete (navigator as { serviceWorker?: unknown }).serviceWorker;
  vi.unstubAllGlobals();
}

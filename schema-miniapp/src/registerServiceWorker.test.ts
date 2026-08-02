// @vitest-environment jsdom
// SW регистрируется только в web-хосте (docs/MULTI_HOST_PLAN.md шаг 3):
// внутри Telegram/MAX мини-апп живёт в вебвью мессенджера — свой SW там
// рискует отдать устаревшую оболочку. workbox-window мокнут: jsdom не
// реализует navigator.serviceWorker/ServiceWorkerRegistration.
//
// getHost() определяет хост живым чтением window.Telegram/window.WebApp
// (см. shared/src/host/index.ts) — поэтому хост мокается теми же глобалами,
// что и loginScreenGate.test.ts, а не через setHost() (она перепроверяет
// detectHostId() и пересоздаст хост, если глобалы ему не соответствуют).
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setHost } from '../../shared/src/host';

type Listener = () => void;
const listeners: Record<string, Listener[]> = {};
const registerMock = vi.fn().mockResolvedValue(undefined);
const messageSkipWaitingMock = vi.fn();

vi.mock('workbox-window', () => ({
  // Обычная function-форма обязательна: стрелочная не годится конструктором
  // (`new Workbox(...)` в registerServiceWorker.ts бросил бы TypeError).
  Workbox: vi.fn().mockImplementation(function FakeWorkbox() {
    return {
      addEventListener: (type: string, cb: Listener) => {
        (listeners[type] ??= []).push(cb);
      },
      register: registerMock,
      messageSkipWaiting: messageSkipWaitingMock,
    };
  }),
}));

const { Workbox } = await import('workbox-window');
const {
  shouldRegisterServiceWorker,
  registerServiceWorker,
  onUpdateAvailable,
  applyUpdate,
  _resetForTests,
} = await import('./registerServiceWorker');

function setServiceWorkerSupport(supported: boolean) {
  if (supported) {
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {},
      configurable: true,
    });
  } else {
    // `in` проверяет наличие ключа, а не значение — value: undefined не
    // подходит («старый браузер») и нужно реально удалить свойство.
    delete (navigator as { serviceWorker?: unknown }).serviceWorker;
  }
}

function setTelegramHost() {
  (globalThis as { Telegram?: unknown }).Telegram = {
    WebApp: { initData: 'hash=abc' },
  };
}

function setMaxHost() {
  (globalThis as { WebApp?: unknown }).WebApp = { initData: 'query_id=abc' };
}

beforeEach(() => {
  setHost(null);
  delete (globalThis as { Telegram?: unknown }).Telegram;
  delete (globalThis as { WebApp?: unknown }).WebApp;
  _resetForTests();
  registerMock.mockClear();
  messageSkipWaitingMock.mockClear();
  (Workbox as unknown as ReturnType<typeof vi.fn>).mockClear();
  for (const key of Object.keys(listeners)) delete listeners[key];
  setServiceWorkerSupport(true);
});

describe('shouldRegisterServiceWorker', () => {
  it('web-хост (нет window.Telegram/WebApp) + браузер умеет SW → true', () => {
    expect(shouldRegisterServiceWorker()).toBe(true);
  });

  it('web-хост, но старый браузер без navigator.serviceWorker → false', () => {
    setServiceWorkerSupport(false);
    expect(shouldRegisterServiceWorker()).toBe(false);
  });

  it('Telegram-хост → false', () => {
    setTelegramHost();
    expect(shouldRegisterServiceWorker()).toBe(false);
  });

  it('MAX-хост → false', () => {
    setMaxHost();
    expect(shouldRegisterServiceWorker()).toBe(false);
  });
});

describe('registerServiceWorker', () => {
  it('не в web-хосте — Workbox не создаётся', () => {
    setTelegramHost();
    registerServiceWorker();
    expect(Workbox).not.toHaveBeenCalled();
    expect(registerMock).not.toHaveBeenCalled();
  });

  it('в web-хосте — регистрирует SW со scope /app/', () => {
    registerServiceWorker();
    expect(Workbox).toHaveBeenCalledWith(
      '/app/sw.js',
      expect.objectContaining({ scope: '/app/' }),
    );
    expect(registerMock).toHaveBeenCalled();
  });

  it('событие waiting зовёт подписчика onUpdateAvailable', () => {
    const onUpdate = vi.fn();
    onUpdateAvailable(onUpdate);
    registerServiceWorker();
    listeners.waiting?.forEach((cb) => cb());
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it('отписка onUpdateAvailable останавливает уведомления', () => {
    const onUpdate = vi.fn();
    const unsubscribe = onUpdateAvailable(onUpdate);
    registerServiceWorker();
    unsubscribe();
    listeners.waiting?.forEach((cb) => cb());
    expect(onUpdate).not.toHaveBeenCalled();
  });
});

describe('applyUpdate', () => {
  it('без предшествующей регистрации — не падает', () => {
    expect(() => applyUpdate()).not.toThrow();
    expect(messageSkipWaitingMock).not.toHaveBeenCalled();
  });

  it('после регистрации — шлёт SKIP_WAITING и перезагружает по controllerchange', () => {
    registerServiceWorker();
    const reloadSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload: reloadSpy },
      configurable: true,
    });

    applyUpdate();
    expect(messageSkipWaitingMock).toHaveBeenCalledTimes(1);
    listeners.controlling?.forEach((cb) => cb());
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });
});

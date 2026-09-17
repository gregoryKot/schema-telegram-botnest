// @vitest-environment jsdom
// Эксперимент 2026-08-25 (см. шапку registerServiceWorker.ts): SW в PWA
// выключен — registerServiceWorker теперь СНИМАЕТ установленный ранее SW и
// чистит его кеши, чтобы статика ехала тем же путём, что в Telegram
// (HTTP-кеш + байткод-кеш браузера), а не из Cache Storage без него.
//
// getHost() определяет хост живым чтением window.Telegram/window.WebApp
// (см. shared/src/host/index.ts) — поэтому хост мокается теми же глобалами,
// что и loginScreenGate.test.ts.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setHost } from '../../shared/src/host';
import {
  shouldRegisterServiceWorker,
  registerServiceWorker,
  applyUpdate,
  _resetForTests,
} from './registerServiceWorker';

const unregisterMock = vi.fn().mockResolvedValue(true);
let registrations: { unregister: typeof unregisterMock }[] = [];
const getRegistrationsMock = vi.fn(() => Promise.resolve(registrations));
const cacheKeysMock = vi.fn(() => Promise.resolve(['wb-precache', 'runtime']));
const cacheDeleteMock = vi.fn(() => Promise.resolve(true));

function setServiceWorkerSupport(supported: boolean) {
  if (supported) {
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { getRegistrations: getRegistrationsMock },
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

const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  setHost(null);
  delete (globalThis as { Telegram?: unknown }).Telegram;
  delete (globalThis as { WebApp?: unknown }).WebApp;
  _resetForTests();
  registrations = [];
  unregisterMock.mockClear();
  getRegistrationsMock.mockClear();
  cacheKeysMock.mockClear();
  cacheDeleteMock.mockClear();
  setServiceWorkerSupport(true);
  Object.defineProperty(window, 'caches', {
    value: { keys: cacheKeysMock, delete: cacheDeleteMock },
    configurable: true,
  });
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

describe('registerServiceWorker (эксперимент: снятие SW)', () => {
  it('не в web-хосте — ничего не трогает', async () => {
    setTelegramHost();
    registerServiceWorker();
    await flush();
    expect(getRegistrationsMock).not.toHaveBeenCalled();
  });

  it('стоял SW — снимает его и чистит все кеши', async () => {
    registrations = [{ unregister: unregisterMock }];
    registerServiceWorker();
    await flush();
    expect(unregisterMock).toHaveBeenCalledTimes(1);
    expect(cacheDeleteMock).toHaveBeenCalledWith('wb-precache');
    expect(cacheDeleteMock).toHaveBeenCalledWith('runtime');
  });

  it('SW не стоял (чистый браузер) — кеши НЕ трогает', async () => {
    registrations = [];
    registerServiceWorker();
    await flush();
    expect(unregisterMock).not.toHaveBeenCalled();
    expect(cacheDeleteMock).not.toHaveBeenCalled();
  });

  it('сбой снятия логируется, не бросается наружу', async () => {
    getRegistrationsMock.mockRejectedValueOnce(new Error('boom'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    registerServiceWorker();
    await flush();
    expect(errSpy).toHaveBeenCalledWith('sw cleanup failed', expect.any(Error));
    errSpy.mockRestore();
  });
});

describe('applyUpdate', () => {
  it('без SW достаточно перезагрузки страницы', () => {
    const reload = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload },
      configurable: true,
    });
    applyUpdate();
    expect(reload).toHaveBeenCalledTimes(1);
  });
});

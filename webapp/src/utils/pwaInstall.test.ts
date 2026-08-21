// @vitest-environment jsdom
// Установка PWA из браузера: детект платформы (по нему выбираются шаги
// инструкции), детект standalone (баннер не предлагает уже установленное)
// и модульный перехват beforeinstallprompt (одноразовое событие ловится до
// монтирования React и раздаётся подписчикам).
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  detectInstallPlatform,
  isStandalone,
  hasInstallPrompt,
  subscribeInstallPrompt,
  promptInstall,
  subscribeAppInstalled,
  _resetInstallPromptForTests,
  type BeforeInstallPromptEvent,
} from './pwaInstall';

const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1';
const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36';
const MAC_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0 Safari/537.36';
const WIN_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36';

function fireBeforeInstallPrompt(
  outcome: 'accepted' | 'dismissed' = 'accepted',
) {
  const e = new Event('beforeinstallprompt', { cancelable: true });
  const prompt = vi.fn().mockResolvedValue(undefined);
  Object.assign(e, { prompt, userChoice: Promise.resolve({ outcome }) });
  window.dispatchEvent(e);
  return { event: e as unknown as BeforeInstallPromptEvent, prompt };
}

beforeEach(() => {
  _resetInstallPromptForTests();
});

describe('detectInstallPlatform', () => {
  it('iPhone → ios', () => {
    expect(detectInstallPlatform(IPHONE_UA, 5)).toBe('ios');
  });

  it('Android → android', () => {
    expect(detectInstallPlatform(ANDROID_UA, 5)).toBe('android');
  });

  it('iPadOS прикидывается маком — отличаем по мультитачу', () => {
    expect(detectInstallPlatform(MAC_UA, 5)).toBe('ios');
    expect(detectInstallPlatform(MAC_UA, 0)).toBe('desktop');
  });

  it('Windows → desktop', () => {
    expect(detectInstallPlatform(WIN_UA, 0)).toBe('desktop');
  });
});

describe('isStandalone', () => {
  it('display-mode standalone → true', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('standalone') }));
    expect(isStandalone()).toBe(true);
    vi.unstubAllGlobals();
  });

  it('обычная вкладка (matchMedia нет — jsdom) → false', () => {
    expect(isStandalone()).toBe(false);
  });
});

describe('перехват beforeinstallprompt', () => {
  it('до события промпта нет; после — есть, событие погашено (preventDefault)', () => {
    expect(hasInstallPrompt()).toBe(false);
    const { event } = fireBeforeInstallPrompt();
    expect(hasInstallPrompt()).toBe(true);
    expect((event as unknown as Event).defaultPrevented).toBe(true);
  });

  it('подписчик узнаёт о пойманном событии', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeInstallPrompt(listener);
    fireBeforeInstallPrompt();
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('promptInstall показывает диалог, отдаёт исход и сжигает событие', async () => {
    const { prompt } = fireBeforeInstallPrompt('accepted');
    await expect(promptInstall()).resolves.toBe('accepted');
    expect(prompt).toHaveBeenCalledTimes(1);
    // Событие одноразовое: второй вызов без нового события — unavailable.
    expect(hasInstallPrompt()).toBe(false);
    await expect(promptInstall()).resolves.toBe('unavailable');
  });

  it('subscribeAppInstalled ловит appinstalled и снимается', () => {
    const cb = vi.fn();
    const off = subscribeAppInstalled(cb);
    window.dispatchEvent(new Event('appinstalled'));
    expect(cb).toHaveBeenCalledTimes(1);
    off();
    window.dispatchEvent(new Event('appinstalled'));
    expect(cb).toHaveBeenCalledTimes(1);
  });
});

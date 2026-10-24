// @vitest-environment jsdom
// registerSessionRetryListeners — регресс «постоянно нужно логиниться
// заново» (2026-08-21, пункт 3): после сна устройства/разрыва сети ничто не
// пыталось перевыпустить сессию само.
import { describe, it, expect, vi } from 'vitest';
import { registerSessionRetryListeners } from './sessionRetryListeners';

describe('registerSessionRetryListeners', () => {
  it('online дёргает renewSession и снимает кулдаун, если неудача была временной', () => {
    const renewSession = vi.fn().mockResolvedValue(true);
    const clearTransientCooldown = vi.fn();
    registerSessionRetryListeners({ renewSession, clearTransientCooldown });

    window.dispatchEvent(new Event('online'));

    expect(clearTransientCooldown).toHaveBeenCalledTimes(1);
    expect(renewSession).toHaveBeenCalledTimes(1);
  });

  it('visibilitychange в состояние "visible" тоже дёргает renewSession', () => {
    const renewSession = vi.fn().mockResolvedValue(true);
    const clearTransientCooldown = vi.fn();
    registerSessionRetryListeners({ renewSession, clearTransientCooldown });

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    document.dispatchEvent(new Event('visibilitychange'));

    expect(renewSession).toHaveBeenCalledTimes(1);
  });

  it('visibilitychange в "hidden" НЕ дёргает renewSession (уходим из вкладки, а не возвращаемся)', () => {
    const renewSession = vi.fn().mockResolvedValue(true);
    const clearTransientCooldown = vi.fn();
    registerSessionRetryListeners({ renewSession, clearTransientCooldown });

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    document.dispatchEvent(new Event('visibilitychange'));

    expect(renewSession).not.toHaveBeenCalled();
  });

  it('без window (SSR/тестовый node-контекст) не падает', () => {
    const original = globalThis.window;
    // @ts-expect-error — имитируем окружение без DOM
    delete globalThis.window;
    expect(() =>
      registerSessionRetryListeners({
        renewSession: vi.fn(),
        clearTransientCooldown: vi.fn(),
      }),
    ).not.toThrow();
    globalThis.window = original;
  });
});

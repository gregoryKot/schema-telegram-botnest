// @vitest-environment jsdom
// Единая точка тактильного отклика: делегирует текущему хосту (getHost()).
// createTelegramHost/createWebHost уже проверены в host.test.ts напрямую —
// здесь только связка "haptic.* зовёт правильный метод хоста".
import { describe, it, expect, vi, afterEach } from 'vitest';
import { haptic } from './haptic';
import { setHost } from './index';
import type { HostBridge } from './types';

afterEach(() => {
  setHost(null);
});

describe('haptic', () => {
  it('каждый метод делегирует одноимённому методу текущего хоста', () => {
    const fakeHaptic = {
      tap: vi.fn(),
      press: vi.fn(),
      select: vi.fn(),
      success: vi.fn(),
      warning: vi.fn(),
      error: vi.fn(),
    };
    // getHost() перепроверяет id хоста при каждом вызове (см. index.ts) —
    // фейку нужен id, совпадающий с detectHostId() в тестовом jsdom ('web'),
    // иначе setHost тихо отбросится и подставится настоящий createWebHost().
    setHost({ id: 'web', haptic: fakeHaptic } as unknown as HostBridge);

    haptic.tap();
    haptic.press();
    haptic.select();
    haptic.success();
    haptic.warning();
    haptic.error();

    expect(fakeHaptic.tap).toHaveBeenCalledTimes(1);
    expect(fakeHaptic.press).toHaveBeenCalledTimes(1);
    expect(fakeHaptic.select).toHaveBeenCalledTimes(1);
    expect(fakeHaptic.success).toHaveBeenCalledTimes(1);
    expect(fakeHaptic.warning).toHaveBeenCalledTimes(1);
    expect(fakeHaptic.error).toHaveBeenCalledTimes(1);
  });
});

// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { useHostSafeTop } from './useHostSafeTop';
import { installTelegram, removeTelegram } from '../host/tgStub.test-helpers';

const read = () => document.documentElement.style.getPropertyValue('--safe-top');

afterEach(() => {
  removeTelegram();
  cleanup();
});

describe('useHostSafeTop', () => {
  it('в браузере пишет --safe-top: 0px', () => {
    removeTelegram();
    renderHook(() => useHostSafeTop());
    expect(read()).toBe('0px');
  });

  it('в Telegram отступ положительный, при размонтировании переменная снимается', () => {
    installTelegram({
      isFullscreen: true,
      safeAreaInset: { top: 47, bottom: 0, left: 0, right: 0 },
      contentSafeAreaInset: { top: 56, bottom: 0, left: 0, right: 0 },
    });
    const view = renderHook(() => useHostSafeTop());
    expect(parseInt(read(), 10)).toBeGreaterThan(87);
    view.unmount();
    expect(read()).toBe('');
  });
});

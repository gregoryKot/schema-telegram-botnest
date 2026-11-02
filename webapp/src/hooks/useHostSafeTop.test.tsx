// @vitest-environment jsdom
// Хук пишет --host-safe-top, а не --safe-top: итоговый --safe-top считает
// index.css как max() из этой переменной и env(safe-area-inset-top) (#902) —
// сверка имени переменной с CSS живёт в styles/safeTop.test.ts.
import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { useHostSafeTop } from './useHostSafeTop';
import { installTelegram, removeTelegram } from '../host/tgStub.test-helpers';

const read = () => document.documentElement.style.getPropertyValue('--host-safe-top');

afterEach(() => {
  removeTelegram();
  cleanup();
});

describe('useHostSafeTop', () => {
  it('в браузере пишет --host-safe-top: 0px и не трогает --safe-top', () => {
    removeTelegram();
    renderHook(() => useHostSafeTop());
    expect(read()).toBe('0px');
    expect(document.documentElement.style.getPropertyValue('--safe-top')).toBe('');
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

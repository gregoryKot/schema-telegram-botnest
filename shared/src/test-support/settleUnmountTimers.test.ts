// Пин ожидания из rtlCleanup.ts (afterAll в setupFiles трёх пакетов).
import { describe, it, expect, vi } from 'vitest';
import { settleUnmountTimers } from './settleUnmountTimers';

describe('settleUnmountTimers', () => {
  it('таймер размонтирования на 1 мс срабатывает до конца ожидания', async () => {
    let fired = false;
    setTimeout(() => {
      fired = true;
    }, 1);
    await settleUnmountTimers(() => vi.isFakeTimers());
    expect(fired).toBe(true);
  });

  it('с поддельными таймерами не ждёт и не виснет', async () => {
    vi.useFakeTimers();
    try {
      await settleUnmountTimers(() => vi.isFakeTimers());
    } finally {
      vi.useRealTimers();
    }
    expect(vi.isFakeTimers()).toBe(false);
  });
});

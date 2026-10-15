// Пин функции ожидания из rtlCleanup.ts (afterAll в setupFiles трёх пакетов).
// Проводку самого afterAll держит rtlCleanup.test.tsx (aroundAll).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { settleUnmountTimers } from './settleUnmountTimers';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('settleUnmountTimers', () => {
  it('таймер размонтирования на 1 мс срабатывает до конца ожидания', async () => {
    let fired = false;
    setTimeout(() => {
      fired = true;
    }, 1);
    await settleUnmountTimers();
    expect(fired).toBe(true);
  });

  it('поддельные таймеры не вешают ожидание', async () => {
    vi.useFakeTimers();
    await settleUnmountTimers();
    expect(true).toBe(true);
  });

  it('подменённый setTimeout не вешает ожидание', async () => {
    vi.stubGlobal('setTimeout', vi.fn());
    await settleUnmountTimers();
    expect(true).toBe(true);
  });
});

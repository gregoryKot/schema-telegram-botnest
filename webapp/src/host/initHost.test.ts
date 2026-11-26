import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { initHost, _resetInitHostForTests } from './initHost';
import { installTelegram, removeTelegram } from './tgStub.test-helpers';

beforeEach(() => {
  _resetInitHostForTests();
  vi.useFakeTimers();
  removeTelegram();
});
afterEach(() => {
  vi.useRealTimers();
  removeTelegram();
});

describe('initHost', () => {
  it('в браузере ничего не зовёт и не падает', () => {
    expect(() => {
      initHost();
      vi.advanceTimersByTime(5000);
    }).not.toThrow();
  });

  it('в Telegram ready/expand зовутся ровно один раз', () => {
    const ready = vi.fn();
    const expand = vi.fn();
    installTelegram({ ready, expand });
    initHost();
    vi.advanceTimersByTime(5000);
    expect(ready).toHaveBeenCalledTimes(1);
    expect(expand).toHaveBeenCalledTimes(1);
  });

  it('повторный запуск (перемонтирование) второй раз не зовёт', () => {
    const ready = vi.fn();
    installTelegram({ ready, expand: vi.fn() });
    initHost();
    initHost();
    vi.advanceTimersByTime(5000);
    expect(ready).toHaveBeenCalledTimes(1);
  });

  it('SDK доехал позже старта — вызов всё равно происходит, один раз', () => {
    const ready = vi.fn();
    const expand = vi.fn();
    initHost();
    installTelegram({ ready, expand });
    vi.advanceTimersByTime(5000);
    expect(ready).toHaveBeenCalledTimes(1);
    expect(expand).toHaveBeenCalledTimes(1);
  });
});

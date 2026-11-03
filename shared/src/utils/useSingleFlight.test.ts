// @vitest-environment jsdom
// Повтор действия, пока первое в полёте, — no-op (двойной Enter создавал двух
// клиентов, QA 2026-11). После ответа — и успеха, и сбоя — защита снимается.
import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useSingleFlight } from './useSingleFlight';

describe('useSingleFlight', () => {
  it('два вызова в одном кадре — действие выполнено один раз', async () => {
    let resolve!: (v: string) => void;
    const fn = vi.fn(() => new Promise<string>((r) => (resolve = r)));
    const { result } = renderHook(() => useSingleFlight());
    const run = result.current(fn);
    let first!: Promise<string | undefined>;
    let second!: Promise<string | undefined>;
    act(() => {
      first = run();
      second = run();
    });
    expect(fn).toHaveBeenCalledTimes(1);
    await act(async () => resolve('готово'));
    await expect(first).resolves.toBe('готово');
    await expect(second).resolves.toBeUndefined();
  });

  it('один флаг на все обёрнутые действия хука', async () => {
    let resolve!: () => void;
    const a = vi.fn(() => new Promise<void>((r) => (resolve = r)));
    const b = vi.fn(() => Promise.resolve());
    const { result } = renderHook(() => useSingleFlight());
    let pending!: Promise<void | undefined>;
    act(() => {
      pending = result.current(a)();
      void result.current(b)();
    });
    expect(b).not.toHaveBeenCalled();
    await act(async () => {
      resolve();
      await pending;
    });
    await act(() => result.current(b)());
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('сбой пробрасывается и снимает защиту: повтор уходит', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce('ok');
    const { result } = renderHook(() => useSingleFlight());
    const run = result.current(fn as () => Promise<string>);
    await expect(run()).rejects.toThrow('offline');
    await expect(run()).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('аргументы доходят до действия', async () => {
    const fn = vi.fn((x: number, y: string) => Promise.resolve(`${x}${y}`));
    const { result } = renderHook(() => useSingleFlight());
    await expect(result.current(fn)(1, 'а')).resolves.toBe('1а');
  });
});

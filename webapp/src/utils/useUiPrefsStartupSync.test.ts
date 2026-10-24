// @vitest-environment jsdom
// Стартовая синхронизация настроек экранов: порядок «закрыть пуш → получить
// ответ → применить → пустить экраны» и поведение при медленной сети и отказе.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUiPrefsStartupSync } from './useUiPrefsStartupSync';

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const sync = vi.fn();
const reset = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  sync.mockReset();
  reset.mockReset();
});
afterEach(() => vi.useRealTimers());

describe('useUiPrefsStartupSync', () => {
  it('пуш закрыт сразу, экраны ждут ответа; после применения серверных значений — пускает', async () => {
    const d = deferred<{ uiPrefs: Record<string, string> }>();
    const { result } = renderHook(() =>
      useUiPrefsStartupSync({ load: () => d.promise, sync, reset }),
    );
    expect(reset).toHaveBeenCalledTimes(1);
    expect(result.current).toBe(false);
    expect(sync).not.toHaveBeenCalled();

    await act(async () => d.resolve({ uiPrefs: { today_streak_hidden: '1' } }));
    expect(sync).toHaveBeenCalledWith({ today_streak_hidden: '1' });
    expect(result.current).toBe(true);
    expect(reset.mock.invocationCallOrder[0]).toBeLessThan(sync.mock.invocationCallOrder[0]);
  });

  it('отказ запроса: экраны пускаем, sync не вызывается — пуш остаётся закрытым', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const d = deferred<never>();
    const { result } = renderHook(() =>
      useUiPrefsStartupSync({ load: () => d.promise, sync, reset }),
    );
    await act(async () => d.reject(new Error('offline')));
    expect(result.current).toBe(true);
    expect(sync).not.toHaveBeenCalled();
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });

  it('медленная сеть: по таймауту экраны пускаем, а поздний ответ всё равно применяем', async () => {
    const d = deferred<{ uiPrefs: Record<string, string> }>();
    const { result } = renderHook(() =>
      useUiPrefsStartupSync({ load: () => d.promise, sync, reset, timeoutMs: 3000 }),
    );
    await act(async () => void (await vi.advanceTimersByTimeAsync(2999)));
    expect(result.current).toBe(false);
    await act(async () => void (await vi.advanceTimersByTimeAsync(1)));
    expect(result.current).toBe(true);
    expect(sync).not.toHaveBeenCalled();

    await act(async () => d.resolve({ uiPrefs: { today_phrase_hidden: '1' } }));
    expect(sync).toHaveBeenCalledWith({ today_phrase_hidden: '1' });
  });

  it('ответ без uiPrefs (старый сервер) тоже проходит через sync — миграция сама решит', async () => {
    const { result } = renderHook(() =>
      useUiPrefsStartupSync({ load: () => Promise.resolve({}), sync, reset }),
    );
    await act(async () => undefined);
    expect(sync).toHaveBeenCalledWith(undefined);
    expect(result.current).toBe(true);
  });

  it('выход из кабинета до ответа: чужой ответ не применяется', async () => {
    const d = deferred<{ uiPrefs: Record<string, string> }>();
    const { unmount } = renderHook(() =>
      useUiPrefsStartupSync({ load: () => d.promise, sync, reset }),
    );
    unmount();
    await act(async () => d.resolve({ uiPrefs: { today_streak_hidden: '1' } }));
    expect(sync).not.toHaveBeenCalled();
  });
});

// @vitest-environment jsdom
// Регрессия инцидента 2026-08: выбор режимов терялся, если пользователь не
// долистывал до кнопки «Сохранить» внизу списка. Хук обязан сохранять сам —
// с дебаунсом и с досылкой при закрытии экрана.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAutosavedSelection } from './useAutosavedSelection';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useAutosavedSelection', () => {
  it('сохраняет выбор сам, без нажатия кнопки', async () => {
    const save = vi.fn();
    const { result } = renderHook(() => useAutosavedSelection([], save));

    await act(async () => {
      result.current.toggle('vulnerable_child');
    });
    expect(save).not.toHaveBeenCalled(); // ждём паузу, а не шлём на каждый тап

    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(['vulnerable_child']);
  });

  it('серия быстрых отметок — один запрос с итоговым списком', async () => {
    const save = vi.fn();
    const { result } = renderHook(() => useAutosavedSelection([], save));

    await act(async () => {
      result.current.toggle('a');
    });
    await act(async () => {
      result.current.toggle('b');
    });
    await act(async () => {
      result.current.toggle('a');
    }); // передумал
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(['b']);
  });

  it('закрытие экрана до паузы не теряет выбор', async () => {
    const save = vi.fn();
    const { result, unmount } = renderHook(() =>
      useAutosavedSelection(['a'], save),
    );

    await act(async () => {
      result.current.toggle('b');
    });
    unmount(); // свайп/тап мимо шита — раньше здесь выбор пропадал
    expect(save).toHaveBeenCalledWith(['a', 'b']);
  });

  it('ничего не трогали — сохранять нечего', () => {
    const save = vi.fn();
    const { unmount } = renderHook(() => useAutosavedSelection(['a'], save));
    unmount();
    expect(save).not.toHaveBeenCalled();
  });

  it('flush отправляет немедленно и не дублирует по таймеру', async () => {
    const save = vi.fn();
    const { result } = renderHook(() => useAutosavedSelection([], save));

    await act(async () => {
      result.current.toggle('a');
    });
    await act(async () => {
      result.current.flush();
    });
    expect(save).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('ids отражают выбор для отрисовки галочек', async () => {
    const { result } = renderHook(() => useAutosavedSelection(['a'], vi.fn()));
    await act(async () => {
      result.current.toggle('b');
    });
    expect(result.current.ids).toEqual(['a', 'b']);
    await act(async () => {
      result.current.toggle('a');
    });
    expect(result.current.ids).toEqual(['b']);
  });
});

// @vitest-environment jsdom
// useAutosavedSelection — автосохранение множественного выбора без кнопки
// «Сохранить» (жалоба пользователя, закрытый PR #237): дебаунс после
// изменения, досылка несохранённого при размонтировании, отсутствие вызова
// без изменений, отсутствие дубля, если уже сохранено.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAutosavedSelection } from './useAutosavedSelection';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useAutosavedSelection — базовый выбор', () => {
  it('toggle добавляет и убирает id из ids (настоящий toggle)', () => {
    const { result } = renderHook(() => useAutosavedSelection([], () => {}));
    act(() => result.current.toggle('a'));
    expect(result.current.ids).toEqual(['a']);
    act(() => result.current.toggle('a'));
    expect(result.current.ids).toEqual([]);
  });

  it('initial предзаполняет выбор', () => {
    const { result } = renderHook(() =>
      useAutosavedSelection(['abandonment'], () => {}),
    );
    expect(result.current.ids).toEqual(['abandonment']);
  });
});

describe('useAutosavedSelection — дебаунс', () => {
  it('onSave не вызывается сразу после toggle', () => {
    const onSave = vi.fn();
    const { result } = renderHook(() => useAutosavedSelection([], onSave));
    act(() => result.current.toggle('a'));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('onSave вызывается один раз через 600мс после ПОСЛЕДНЕГО изменения', () => {
    const onSave = vi.fn();
    const { result } = renderHook(() => useAutosavedSelection([], onSave));
    act(() => result.current.toggle('a'));
    void act(() => vi.advanceTimersByTime(300));
    act(() => result.current.toggle('b'));
    // 300мс с первого тапа прошло, но таймер перезапустился вторым тапом —
    // если бы дебаунс не сбрасывался, onSave улетел бы уже здесь.
    void act(() => vi.advanceTimersByTime(300));
    expect(onSave).not.toHaveBeenCalled();
    void act(() => vi.advanceTimersByTime(300));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(['a', 'b']);
  });

  it('несколько быстрых toggle дают один onSave с итоговым списком', () => {
    const onSave = vi.fn();
    const { result } = renderHook(() => useAutosavedSelection([], onSave));
    act(() => result.current.toggle('a'));
    act(() => result.current.toggle('b'));
    act(() => result.current.toggle('c'));
    void act(() => vi.advanceTimersByTime(600));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(['a', 'b', 'c']);
  });
});

describe('useAutosavedSelection — «не трогали — не сохраняем»', () => {
  it('unmount без единого toggle не вызывает onSave', () => {
    const onSave = vi.fn();
    const { unmount } = renderHook(() => useAutosavedSelection([], onSave));
    unmount();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('время само по себе (без toggle) не вызывает onSave', () => {
    const onSave = vi.fn();
    renderHook(() => useAutosavedSelection(['x'], onSave));
    void act(() => vi.advanceTimersByTime(5000));
    expect(onSave).not.toHaveBeenCalled();
  });
});

describe('useAutosavedSelection — флаш при размонтировании', () => {
  it('toggle и unmount ДО дебаунса всё равно досылают onSave один раз', () => {
    const onSave = vi.fn();
    const { result, unmount } = renderHook(() =>
      useAutosavedSelection([], onSave),
    );
    act(() => result.current.toggle('a'));
    expect(onSave).not.toHaveBeenCalled();
    unmount();
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(['a']);
  });

  it('если дебаунс уже сработал — unmount не дублирует сохранение', () => {
    const onSave = vi.fn();
    const { result, unmount } = renderHook(() =>
      useAutosavedSelection([], onSave),
    );
    act(() => result.current.toggle('a'));
    void act(() => vi.advanceTimersByTime(600));
    expect(onSave).toHaveBeenCalledTimes(1);
    unmount();
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('явный flush() досылает немедленно и гасит отложенный таймер', () => {
    const onSave = vi.fn();
    const { result } = renderHook(() => useAutosavedSelection([], onSave));
    act(() => result.current.toggle('a'));
    act(() => result.current.flush());
    expect(onSave).toHaveBeenCalledTimes(1);
    // таймер уже погашен — дальнейшее течение времени не шлёт второй раз
    void act(() => vi.advanceTimersByTime(600));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('повторный flush() без новых изменений — no-op', () => {
    const onSave = vi.fn();
    const { result } = renderHook(() => useAutosavedSelection([], onSave));
    act(() => result.current.toggle('a'));
    act(() => result.current.flush());
    act(() => result.current.flush());
    expect(onSave).toHaveBeenCalledTimes(1);
  });
});

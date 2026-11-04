// @vitest-environment jsdom
// QA 2026-11, М3: после ошибки сохранения бейдж на исчезновении мигал зелёным
// «Сохранено ✓» — вид зависел от флага ошибки, который гас раньше видимости.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useSaveBadge } from './useSaveBadge';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('useSaveBadge', () => {
  it('ошибка: видна «err» и гаснет, оставаясь «err», — без зелёного кадра', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useSaveBadge());
    act(() => result.current.flashError());
    expect(result.current).toMatchObject({ visible: true, outcome: 'err' });
    act(() => {
      vi.advanceTimersByTime(2500);
    });
    expect(result.current).toMatchObject({ visible: false, outcome: 'err' });
  });

  it('последний исход побеждает: ошибка, затем успех — «ok»', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useSaveBadge());
    act(() => result.current.flashError());
    act(() => result.current.flashSaved());
    expect(result.current).toMatchObject({ visible: true, outcome: 'ok' });
  });
});

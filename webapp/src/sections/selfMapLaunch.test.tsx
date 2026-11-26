// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { requestSelfMapOpen, useSelfMapLaunch } from './selfMapLaunch';

afterEach(cleanup);

describe('selfMapLaunch', () => {
  it('запрос до монтирования открывает карту ровно один раз', () => {
    requestSelfMapOpen();
    const first = renderHook(() => useSelfMapLaunch());
    expect(first.result.current[0]).toBe(true);
    first.unmount();
    expect(renderHook(() => useSelfMapLaunch()).result.current[0]).toBe(false);
  });

  it('запрос на смонтированном экране открывает карту, закрытие работает', () => {
    const { result } = renderHook(() => useSelfMapLaunch());
    expect(result.current[0]).toBe(false);
    act(() => requestSelfMapOpen());
    expect(result.current[0]).toBe(true);
    act(() => result.current[1](false));
    expect(result.current[0]).toBe(false);
  });
});

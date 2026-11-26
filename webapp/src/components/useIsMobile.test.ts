// @vitest-environment jsdom
// useIsMobile — реактивный флаг телефонной раскладки (условие — PHONE_MEDIA,
// общее с CSS). Проверяем: узкий экран, альбомный телефон, десктоп, смену по событию.
import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIsMobile } from './useIsMobile';
import { PHONE_MEDIA } from '../utils/phoneLayout';

interface Env { width: number; height: number; coarse: boolean }
let env: Env = { width: 1024, height: 768, coarse: false };
const listeners = new Set<() => void>();

function setEnv(e: Env) {
  env = e;
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: e.width });
  Object.defineProperty(window, 'matchMedia', {
    writable: true, configurable: true,
    value: (q: string) => ({
      // Только PHONE_MEDIA: «ширина < 768» ИЛИ «касание и высота ≤ 500».
      get matches() {
        return q === PHONE_MEDIA && (env.width <= 767 || (env.coarse && env.height <= 500));
      },
      addEventListener: (_: string, cb: () => void) => listeners.add(cb),
      removeEventListener: (_: string, cb: () => void) => listeners.delete(cb),
    }),
  });
}

afterEach(() => { listeners.clear(); setEnv({ width: 1024, height: 768, coarse: false }); });

describe('useIsMobile', () => {
  it('узкий экран — сразу true', () => {
    setEnv({ width: 400, height: 800, coarse: true });
    expect(renderHook(() => useIsMobile()).result.current).toBe(true);
  });

  it('десктоп — false', () => {
    setEnv({ width: 1200, height: 800, coarse: false });
    expect(renderHook(() => useIsMobile()).result.current).toBe(false);
  });

  it('телефон в альбомной (844×390, касание) — true', () => {
    setEnv({ width: 844, height: 390, coarse: true });
    expect(renderHook(() => useIsMobile()).result.current).toBe(true);
  });

  it('планшет 768×1024 и десктоп с низким окном и мышью — false', () => {
    setEnv({ width: 768, height: 1024, coarse: true });
    expect(renderHook(() => useIsMobile()).result.current).toBe(false);
    setEnv({ width: 1200, height: 400, coarse: false });
    expect(renderHook(() => useIsMobile()).result.current).toBe(false);
  });

  it('поворот телефона (resize) обновляет значение', () => {
    setEnv({ width: 390, height: 844, coarse: true });
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
    act(() => { setEnv({ width: 1100, height: 800, coarse: false }); window.dispatchEvent(new Event('resize')); });
    expect(result.current).toBe(false);
  });
});

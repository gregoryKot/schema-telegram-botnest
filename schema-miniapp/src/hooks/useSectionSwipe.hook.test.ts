// @vitest-environment jsdom
// useSectionSwipe — сам хук (не покрыт: useSectionSwipe.test.ts проверяет
// только чистые isHorizontalSwipe/nextSection). Здесь — обработчики
// onTouchStart/onTouchEnd целиком: жест меняет секцию, disabled блокирует
// переключение, короткий тап игнорируется.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSectionSwipe } from './useSectionSwipe';
import type { Section } from '../components/BottomNav';

const SECTIONS: Section[] = ['today', 'help', 'schemas', 'profile'];

function touch(x: number, y: number) {
  return {
    touches: [{ clientX: x, clientY: y }],
  } as unknown as React.TouchEvent;
}
function touchEnd(x: number, y: number) {
  return {
    changedTouches: [{ clientX: x, clientY: y }],
  } as unknown as React.TouchEvent;
}

afterEach(() => vi.restoreAllMocks());

describe('useSectionSwipe — целостный жест', () => {
  it('свайп влево на достаточное расстояние переключает на соседний раздел', () => {
    const setSection = vi.fn((updater: (cur: Section) => Section) => {
      expect(updater('today')).toBe('help');
    });
    const { result } = renderHook(() =>
      useSectionSwipe({ sections: SECTIONS, setSection, disabled: false }),
    );
    result.current.onTouchStart(touch(200, 100));
    result.current.onTouchEnd(touchEnd(100, 100));
    expect(setSection).toHaveBeenCalledTimes(1);
  });

  it('короткое касание (< 72px) — setSection не зовётся', () => {
    const setSection = vi.fn();
    const { result } = renderHook(() =>
      useSectionSwipe({ sections: SECTIONS, setSection, disabled: false }),
    );
    result.current.onTouchStart(touch(200, 100));
    result.current.onTouchEnd(touchEnd(180, 100));
    expect(setSection).not.toHaveBeenCalled();
  });

  it('disabled=true — жест полностью игнорируется, даже если он валидный', () => {
    const setSection = vi.fn();
    const { result } = renderHook(() =>
      useSectionSwipe({ sections: SECTIONS, setSection, disabled: true }),
    );
    result.current.onTouchStart(touch(200, 100));
    result.current.onTouchEnd(touchEnd(50, 100));
    expect(setSection).not.toHaveBeenCalled();
  });

  it('onTouchEnd без предшествующего onTouchStart — не падает и не зовёт setSection', () => {
    const setSection = vi.fn();
    const { result } = renderHook(() =>
      useSectionSwipe({ sections: SECTIONS, setSection, disabled: false }),
    );
    expect(() => result.current.onTouchEnd(touchEnd(50, 100))).not.toThrow();
    expect(setSection).not.toHaveBeenCalled();
  });
});

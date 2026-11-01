// @vitest-environment jsdom
// Свайп трекера — один хук на обе площадки. Фиксируем обе стороны: жест по
// фону листает (влево — вперёд, вправо — назад), а палец, начавший движение на
// шкале оценки (`[role="group"]`), вертикальный скролл, короткий жест и
// выключенный свайп — не листают.
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useHorizontalSwipe } from './useHorizontalSwipe';

const at = (target: EventTarget | null, x: number, y: number) =>
  ({
    target,
    touches: [{ clientX: x, clientY: y }],
    changedTouches: [{ clientX: x, clientY: y }],
  }) as never;

function setup(disabled = false) {
  const onNext = vi.fn();
  const onPrev = vi.fn();
  const { result } = renderHook(() =>
    useHorizontalSwipe(onNext, onPrev, disabled),
  );
  return { swipe: result.current, onNext, onPrev };
}

function bg() {
  return document.createElement('div');
}

function insideScale() {
  const group = document.createElement('div');
  group.setAttribute('role', 'group');
  const dot = document.createElement('button');
  group.appendChild(dot);
  return dot;
}

describe('useHorizontalSwipe', () => {
  it('жест влево по фону — вперёд', () => {
    const { swipe, onNext, onPrev } = setup();
    swipe.onTouchStart(at(bg(), 300, 100));
    swipe.onTouchEnd(at(null, 150, 110));
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onPrev).not.toHaveBeenCalled();
  });

  it('жест вправо по фону — назад', () => {
    const { swipe, onNext, onPrev } = setup();
    swipe.onTouchStart(at(bg(), 100, 100));
    swipe.onTouchEnd(at(null, 250, 100));
    expect(onPrev).toHaveBeenCalledTimes(1);
    expect(onNext).not.toHaveBeenCalled();
  });

  it('жест, начатый на шкале оценки, не листает', () => {
    const { swipe, onNext, onPrev } = setup();
    swipe.onTouchStart(at(insideScale(), 300, 100));
    swipe.onTouchEnd(at(null, 100, 100));
    expect(onNext).not.toHaveBeenCalled();
    expect(onPrev).not.toHaveBeenCalled();
  });

  it('короткий жест (меньше 90px) не листает', () => {
    const { swipe, onNext } = setup();
    swipe.onTouchStart(at(bg(), 200, 100));
    swipe.onTouchEnd(at(null, 130, 100));
    expect(onNext).not.toHaveBeenCalled();
  });

  it('вертикальный жест (скролл) не листает', () => {
    const { swipe, onNext } = setup();
    swipe.onTouchStart(at(bg(), 300, 100));
    swipe.onTouchEnd(at(null, 180, 300));
    expect(onNext).not.toHaveBeenCalled();
  });

  it('выключенный свайп не листает', () => {
    const { swipe, onNext } = setup(true);
    swipe.onTouchStart(at(bg(), 300, 100));
    swipe.onTouchEnd(at(null, 100, 100));
    expect(onNext).not.toHaveBeenCalled();
  });

  it('конец касания без начала ничего не делает', () => {
    const { swipe, onNext, onPrev } = setup();
    swipe.onTouchEnd(at(null, 100, 100));
    expect(onNext).not.toHaveBeenCalled();
    expect(onPrev).not.toHaveBeenCalled();
  });

  it('цель касания не DOM-элемент — жест считается по фону', () => {
    const { swipe, onNext } = setup();
    swipe.onTouchStart(at(null, 300, 100));
    swipe.onTouchEnd(at(null, 100, 100));
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});

// Разбор жеста на полосе ползунка «Колеса детства»: тап, протяжка, прокрутка.
import { describe, it, expect } from 'vitest';
import { GESTURE_SLOP_PX, moveGesture, startGesture } from './sliderGesture';

describe('sliderGesture', () => {
  it('мышь тянет сразу, палец и перо ждут направления', () => {
    expect(startGesture('mouse', 0, 0).mode).toBe('drag');
    expect(startGesture('touch', 0, 0).mode).toBe('pending');
    expect(startGesture('pen', 0, 0).mode).toBe('pending');
  });

  it('сдвиг меньше порога — ещё тап', () => {
    const g = startGesture('touch', 10, 10);
    const s = GESTURE_SLOP_PX - 1;
    expect(moveGesture(g, 10 + s, 10 - s).mode).toBe('pending');
  });

  it('вбок — протяжка, вверх-вниз — прокрутка; решение не меняется', () => {
    const g = startGesture('touch', 10, 10);
    const drag = moveGesture(g, 30, 14);
    expect(drag.mode).toBe('drag');
    expect(moveGesture(drag, 30, 200).mode).toBe('drag');
    const scroll = moveGesture(g, 13, 40);
    expect(scroll.mode).toBe('scroll');
    expect(moveGesture(scroll, 200, 40).mode).toBe('scroll');
  });
});

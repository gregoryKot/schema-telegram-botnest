// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { KEYBOARD_SETTLE_FALLBACK_MS, keyboardOpen, whenKeyboardSettled } from './keyboardSettled';

// Инцидент 2026-11-05: нижняя навигация посреди экрана после закрытия
// клавиатуры. Клавиатура iOS — visualViewport ниже окна на её высоту.
type VV = EventTarget & { height: number };
let vv: VV;
let scrollTo: ReturnType<typeof vi.fn>;

function setViewport(innerHeight: number, viewport: VV | undefined) {
  Object.defineProperty(window, 'innerHeight', { value: innerHeight, configurable: true });
  Object.defineProperty(window, 'visualViewport', { value: viewport, configurable: true });
}

beforeEach(() => {
  vi.useFakeTimers();
  vv = Object.assign(new EventTarget(), { height: 500 });
  scrollTo = vi.fn();
  window.scrollTo = scrollTo as unknown as typeof window.scrollTo;
  setViewport(800, vv);
});
afterEach(() => {
  vi.useRealTimers();
  setViewport(768, undefined);
});

describe('keyboardOpen', () => {
  it('visualViewport ниже окна на высоту клавиатуры — открыта; на полосу браузера — нет', () => {
    expect(keyboardOpen()).toBe(true);
    vv.height = 760;
    expect(keyboardOpen()).toBe(false);
  });
  it('без visualViewport (старый браузер, jsdom) — не открыта', () => {
    setViewport(800, undefined);
    expect(keyboardOpen()).toBe(false);
  });
});

describe('whenKeyboardSettled', () => {
  it('клавиатуры нет — зовёт сразу, без прокрутки', () => {
    vv.height = 800;
    const cb = vi.fn();
    whenKeyboardSettled(cb);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('клавиатура открыта — ждёт resize до полной высоты, затем нулевая прокрутка и cb', () => {
    const cb = vi.fn();
    whenKeyboardSettled(cb);
    expect(cb).not.toHaveBeenCalled();
    vv.height = 560; // клавиатура ещё уезжает
    vv.dispatchEvent(new Event('resize'));
    expect(cb).not.toHaveBeenCalled();
    vv.height = 800;
    vv.dispatchEvent(new Event('resize'));
    expect(cb).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith(window.scrollX, window.scrollY);
    vv.dispatchEvent(new Event('resize'));
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('resize не пришёл — страховочный таймер, один вызов', () => {
    const cb = vi.fn();
    whenKeyboardSettled(cb);
    vi.advanceTimersByTime(KEYBOARD_SETTLE_FALLBACK_MS - 1);
    expect(cb).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(cb).toHaveBeenCalledTimes(1);
    vv.height = 800;
    vv.dispatchEvent(new Event('resize'));
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('отмена — ни resize, ни таймер не зовут cb', () => {
    const cb = vi.fn();
    const cancel = whenKeyboardSettled(cb);
    cancel();
    vv.height = 800;
    vv.dispatchEvent(new Event('resize'));
    vi.advanceTimersByTime(KEYBOARD_SETTLE_FALLBACK_MS);
    expect(cb).not.toHaveBeenCalled();
    expect(scrollTo).not.toHaveBeenCalled();
  });
});

// Разбор жеста на полосе ползунка «Колеса детства». Полоса во всю ширину и 44px
// высотой, на экране их пять: раньше оценка ставилась уже на pointerdown, и
// палец, начавший прокрутку страницы с полосы, менял ответ (бэклог 2026-10).
// Теперь мышь ставит значение сразу, а палец и перо — по тапу (отпустили без
// сдвига) или после сдвига вбок; сдвиг вверх-вниз отдаёт жест прокрутке.
import { useRef, type PointerEvent } from 'react';

/** Порог сдвига, px: меньше — ещё тап, дальше решает направление. */
export const GESTURE_SLOP_PX = 8;

export type GestureMode = 'pending' | 'drag' | 'scroll';

export interface SliderGesture {
  x: number;
  y: number;
  mode: GestureMode;
}

/** Начало жеста: мышь тянет ползунок сразу, палец и перо ждут направления. */
export function startGesture(
  pointerType: string,
  x: number,
  y: number,
): SliderGesture {
  return { x, y, mode: pointerType === 'mouse' ? 'drag' : 'pending' };
}

/** Сдвиг указателя: пока жест не решён, больший по оси сдвиг выбирает режим. */
export function moveGesture(
  g: SliderGesture,
  x: number,
  y: number,
): SliderGesture {
  if (g.mode !== 'pending') return g;
  const dx = Math.abs(x - g.x);
  const dy = Math.abs(y - g.y);
  if (Math.max(dx, dy) < GESTURE_SLOP_PX) return g;
  return { ...g, mode: dx > dy ? 'drag' : 'scroll' };
}

/**
 * Pointer-обработчики трека. `fromPointer` ставит значение по координате X.
 * Прокрутку страницы браузер забирает сам (`touch-action: pan-y` у трека) и
 * шлёт pointercancel — жест сбрасывается без оценки.
 */
export function useSliderPointer(fromPointer: (clientX: number) => void) {
  const gesture = useRef<SliderGesture | null>(null);
  return {
    onPointerDown: (e: PointerEvent<HTMLDivElement>) => {
      gesture.current = startGesture(e.pointerType, e.clientX, e.clientY);
      if (gesture.current.mode !== 'drag') return; // палец: ждём тап или сдвиг
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      fromPointer(e.clientX);
    },
    onPointerMove: (e: PointerEvent<HTMLDivElement>) => {
      const was = gesture.current;
      if (!was || e.buttons === 0) return; // без нажатия — просто наведение
      gesture.current = moveGesture(was, e.clientX, e.clientY);
      if (gesture.current.mode !== 'drag') return;
      if (was.mode === 'pending')
        e.currentTarget.setPointerCapture(e.pointerId);
      fromPointer(e.clientX);
    },
    onPointerUp: (e: PointerEvent<HTMLDivElement>) => {
      if (gesture.current?.mode === 'pending') fromPointer(e.clientX); // тап
      gesture.current = null;
    },
    onPointerCancel: () => {
      gesture.current = null;
    },
  };
}

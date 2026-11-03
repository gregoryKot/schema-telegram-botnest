import { useRef, type TouchEvent } from 'react';

// Горизонтальный свайп между вопросами трекера — один на обе площадки
// (webapp TrackerOverlay и мини-апп TrackerOverlay держали по копии).
// Влево — вперёд, вправо — назад; порог 90px, вертикальные жесты (скролл) не
// считаются. Касание внутри `[role="group"]` — шкалы оценки (NeedScale /
// WordScale / NeedRatingBar) и точек потребностей — не свайп: палец,
// проехавший по шкале, не уводит на другую потребность (docs/open/frontend-ux.md).
const SWIPE_IGNORE = '[role="group"]';
const MIN_DX = 90;
const MAX_SLOPE = 0.5;

export function useHorizontalSwipe(
  onNext: () => void,
  onPrev: () => void,
  disabled: boolean,
) {
  const start = useRef<{ x: number; y: number } | null>(null);
  return {
    onTouchStart: (e: TouchEvent) => {
      const onControls =
        e.target instanceof Element && e.target.closest(SWIPE_IGNORE);
      start.current = onControls
        ? null
        : { x: e.touches[0].clientX, y: e.touches[0].clientY };
    },
    onTouchEnd: (e: TouchEvent) => {
      const s = start.current;
      start.current = null;
      if (!s || disabled) return;
      const dx = e.changedTouches[0].clientX - s.x;
      const dy = e.changedTouches[0].clientY - s.y;
      if (Math.abs(dx) < MIN_DX || Math.abs(dy) > Math.abs(dx) * MAX_SLOPE)
        return;
      if (dx < 0) onNext();
      else onPrev();
    },
  };
}

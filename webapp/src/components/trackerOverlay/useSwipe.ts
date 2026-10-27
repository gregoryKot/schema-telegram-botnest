import { useRef } from 'react';

/** Горизонтальный свайп по оверлею: влево — вперёд, вправо — назад. Вертикальные жесты (скролл) не считаются. */
export function useSwipe(onNext: () => void, onPrev: () => void, disabled: boolean) {
  const start = useRef<{ x: number; y: number } | null>(null);
  return {
    onTouchStart: (e: React.TouchEvent) => {
      start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    },
    onTouchEnd: (e: React.TouchEvent) => {
      const s = start.current;
      start.current = null;
      if (!s || disabled) return;
      const dx = e.changedTouches[0].clientX - s.x;
      const dy = e.changedTouches[0].clientY - s.y;
      if (Math.abs(dx) < 90 || Math.abs(dy) > Math.abs(dx) * 0.5) return;
      if (dx < 0) onNext();
      else onPrev();
    },
  };
}

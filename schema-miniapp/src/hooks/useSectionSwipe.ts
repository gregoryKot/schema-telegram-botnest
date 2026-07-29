// Свайп между разделами. Вынесен из App.tsx: это логика (пороги, направление,
// блокировка при открытом оверлее), и она обязана быть проверяемой отдельно от
// шестисотстрочного App (правила №2 и №10).
import { useCallback, useRef } from 'react';
import type { Section } from '../components/BottomNav';

const MIN_DX = 72; // короче — случайное касание, а не листание
const MAX_DY_RATIO = 0.6; // вертикальнее — это скролл списка, не свайп

/** Жест засчитан: достаточно длинный и достаточно горизонтальный. */
export function isHorizontalSwipe(dx: number, dy: number): boolean {
  return Math.abs(dx) >= MIN_DX && Math.abs(dy) <= Math.abs(dx) * MAX_DY_RATIO;
}

/** Сосед по направлению; на краях списка остаёмся на месте. */
export function nextSection(
  sections: readonly Section[],
  current: Section,
  dx: number,
): Section {
  const idx = sections.indexOf(current);
  if (dx < 0 && idx < sections.length - 1) return sections[idx + 1];
  if (dx > 0 && idx > 0) return sections[idx - 1];
  return current;
}

export function useSectionSwipe(opts: {
  sections: readonly Section[];
  setSection: (updater: (cur: Section) => Section) => void;
  disabled: boolean;
}) {
  const { sections, setSection, disabled } = opts;
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    startRef.current = { x: t.clientX, y: t.clientY };
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const start = startRef.current;
      startRef.current = null;
      if (!start || disabled) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      if (!isHorizontalSwipe(dx, dy)) return;
      setSection((cur) => nextSection(sections, cur, dx));
    },
    [disabled, sections, setSection],
  );

  return { onTouchStart, onTouchEnd };
}

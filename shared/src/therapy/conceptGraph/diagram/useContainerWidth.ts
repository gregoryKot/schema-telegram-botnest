import { useLayoutEffect, useRef, useState, type RefObject } from 'react';

/** Ширина, пока контейнер не измерен (и в окружении без ResizeObserver). */
export const FALLBACK_WIDTH = 960;

/**
 * Ширина блока в пикселях и её обновление при изменении размера. Диаграмма
 * раскладывается под эту ширину, поэтому до первого замера и в jsdom (там
 * ширина нулевая) берётся запасная.
 */
export function useContainerWidth(): [
  RefObject<HTMLDivElement | null>,
  number,
] {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(FALLBACK_WIDTH);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const w = Math.round(el.clientWidth);
      if (w > 0) setWidth(w);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

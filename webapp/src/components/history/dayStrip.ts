// Полоса дат истории (DateStrip): затухание краёв ленты. Полоски дня — общая dayStrokeValues
// (shared/src/needs/dayStrokes.ts), та же, что у главной и меню.
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * С какой стороны за краем полосы ещё есть дни — там край затухает (маска в history.css),
 * а не режет последний листок пополам. Полпикселя — допуск дробной прокрутки.
 */
export function stripEdges(scrollLeft: number, clientWidth: number, scrollWidth: number): { start: boolean; end: boolean } {
  return { start: scrollLeft > 0.5, end: scrollLeft + clientWidth < scrollWidth - 0.5 };
}

/** Края ленты для затухания: пересчёт при прокрутке (onScroll ленты), смене окна и числа дней. */
export function useStripEdges(days: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });
  const measure = useCallback(() => {
    const el = ref.current;
    if (el) setEdges(stripEdges(el.scrollLeft, el.clientWidth, el.scrollWidth));
  }, []);
  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure, days]);
  return { ref, edges, measure };
}

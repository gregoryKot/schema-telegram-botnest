// Полоса дат истории (DateStrip): листок дня с пятью полосками его оценок и затухание краёв.
import { useCallback, useEffect, useRef, useState } from 'react';
import { NEED_ORDER } from '../../../../shared/src/needs/types';
import { isRated } from '../../../../shared/src/needs/ratingRecord';

/** Оценки дня по NEED_ORDER для Strokes values; не оценена (0 или нет ключа) — null, пустой тон. */
export function dayValues(ratings: Readonly<Record<string, number>>): (number | null)[] {
  return NEED_ORDER.map((id) => (isRated(ratings, id) ? ratings[id] : null));
}

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

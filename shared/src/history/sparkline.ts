// Линия потребности по дням — одна на всё приложение: «Неделя» в истории (SparklineRow) и
// «Динамика потребности» (NeedDynamics); окно дней и геометрия. QA 2026-11 (B-М4): подпись «За 7 дней», а
// линии шли по всей загруженной истории (~30 точек); точка-маркер сплющивалась
// в овал, потому что svg растянут с preserveAspectRatio="none". Теперь окно —
// N дней, которые кончаются выбранным днём, а маркер рисуется поверх svg
// HTML-элементом по процентам — растяжение его не искажает.
import type { DayHistory } from '../types';

export const SPARK_W = 100;
export const SPARK_H = 28;

/**
 * Окно «За N дней»: выбранный день и N−1 дней до него. История идёт от
 * новых к старым, поэтому выбранный день — первый элемент окна; дней в
 * окне меньше N, только если раньше истории нет.
 */
export function weekWindow(
  history: DayHistory[],
  selectedIdx: number,
  days: number,
): DayHistory[] {
  return history.slice(selectedIdx, selectedIdx + days);
}

export interface SparklineGeometry {
  /** Путь линии (`d`) и заливки под ней в координатах viewBox. */
  line: string;
  area: string;
  /** Точки polyline. */
  points: string;
  /** Маркер выбранного дня в процентах от ширины и высоты графика. */
  dot: { left: number; top: number };
}

/** y оценки 0–10 на холсте SPARK_W×SPARK_H; 0 — день без оценки, прижат к низу. Им же — линия детства. */
export const sparkY = (v: number): number =>
  v <= 0 ? SPARK_H - 1 : 25 - ((Math.min(v, 10) - 1) / 9) * 23;

const fx = (n: number): string => n.toFixed(1);

/** Геометрия линии потребности по окну дней (новые первыми, слева — старые). */
export function sparklineGeometry(
  span: DayHistory[],
  needId: string,
): SparklineGeometry {
  const days = [...span].reverse();
  const n = days.length;
  const xAt = (i: number): number =>
    n > 1 ? (i * SPARK_W) / (n - 1) : SPARK_W / 2;
  const pts = days.map((d, i) => ({
    x: xAt(i),
    y: sparkY(d.ratings[needId] ?? 0),
  }));
  const line = pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${fx(p.x)} ${fx(p.y)}`)
    .join(' ');
  const last = pts[n - 1] ?? { x: SPARK_W / 2, y: SPARK_H - 1 };
  const first = pts[0] ?? last;
  return {
    line,
    area:
      n > 0
        ? `${line} L ${fx(last.x)} ${SPARK_H} L ${fx(first.x)} ${SPARK_H} Z`
        : '',
    points: pts.map((p) => `${fx(p.x)},${fx(p.y)}`).join(' '),
    dot: { left: (last.x / SPARK_W) * 100, top: (last.y / SPARK_H) * 100 },
  };
}

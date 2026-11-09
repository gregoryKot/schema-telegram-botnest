// Линия потребности по дням — одна на всё приложение: «Неделя» в истории (SparklineRow) и
// «Динамика потребности» (NeedDynamics). QA 2026-11 (B-М4): окно — N дней, которые кончаются
// выбранным днём (не вся история), маркер — HTML поверх svg по процентам (в растянутом
// preserveAspectRatio="none" круг сплющивался). День без оценки линию рвёт (sparkRuns.ts).
import type { DayHistory } from '../types';
import { sparkPaths, type SparkPaths, type SparkPt } from './sparkRuns';

export const SPARK_W = 100;
export const SPARK_H = 28;
/** Неделя истории: «За 7 дней» у «Недели» и у «Динамики потребности». */
export const WEEK_DAYS = 7;

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

export interface SparklineGeometry extends SparkPaths {
  /** Маркер выбранного дня в процентах; у дня без оценки маркера нет. */
  dot: { left: number; top: number } | null;
}

/** y оценки 1–10 на холсте SPARK_W×SPARK_H (им же — линия детства); 0 — прижат к низу. */
export const sparkY = (v: number): number =>
  v <= 0 ? SPARK_H - 1 : 25 - ((Math.min(v, 10) - 1) / 9) * 23;

/** Геометрия линии потребности по окну дней (новые первыми, слева — старые). */
export function sparklineGeometry(
  span: DayHistory[],
  needId: string,
): SparklineGeometry {
  const n = span.length;
  const xAt = (i: number) => (n > 1 ? (i * SPARK_W) / (n - 1) : SPARK_W / 2);
  const pts = [...span].reverse().map((d, i): SparkPt | null => {
    const v = d.ratings[needId] ?? 0;
    return v > 0 ? { x: xAt(i), y: sparkY(v) } : null;
  });
  const last = pts[n - 1];
  return {
    ...sparkPaths(pts, SPARK_H),
    dot: last
      ? { left: (last.x / SPARK_W) * 100, top: (last.y / SPARK_H) * 100 }
      : null,
  };
}

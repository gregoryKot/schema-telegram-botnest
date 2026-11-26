// Точки линии потребности — HTML-маркеры поверх svg по процентам холста, а не фигуры в нём: svg
// растянут (preserveAspectRatio="none"), круг в нём сплющивался (QA 2026-11, B-М4). Выбранный день
// (`dot`) и одиночные дни между пропусками (`points`, ревью g2 r5: отрезок нулевой длины в пути рисует
// только круглый конец обводки, а WebKit — Telegram и PWA на iOS — в стенде не проверен).
import type { SparkPaths, SparkPt } from './sparkRuns';

export type SparkMark = { left: number; top: number };

export interface SparkMarks {
  /** Маркер выбранного дня; у дня без оценки маркера нет. */
  dot: SparkMark | null;
  /** Одиночные дни точками. */
  points: SparkMark[];
}

/** Пути линии и маркеры её точек на холсте w×h; `last` — выбранный день (последняя точка окна). */
export function withSparkMarks(
  paths: SparkPaths,
  last: SparkPt | null,
  w: number,
  h: number,
): SparkPaths & SparkMarks {
  const mark = (p: SparkPt): SparkMark => ({
    left: (p.x / w) * 100,
    top: (p.y / h) * 100,
  });
  return {
    ...paths,
    dot: last ? mark(last) : null,
    points: paths.singles.map(mark),
  };
}

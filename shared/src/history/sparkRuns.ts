// Отрезки линии потребности (sparkline.ts): подряд идущие дни с оценкой. День без оценки линию
// рвёт: прежде он рисовался провалом до пола, то есть выдуманным нулём (ревью g2 r3).
export type SparkPt = { x: number; y: number };

const fx = (n: number): string => n.toFixed(1);
const at = (p: SparkPt): string => `${fx(p.x)} ${fx(p.y)}`;

/** Делит точки окна на отрезки; null — день без оценки, разрыв. */
export function sparkRuns(pts: (SparkPt | null)[]): SparkPt[][] {
  const runs: SparkPt[][] = [];
  let run: SparkPt[] = [];
  for (const p of [...pts, null]) {
    if (p) run.push(p);
    else if (run.length) {
      runs.push(run);
      run = [];
    }
  }
  return runs;
}

/** Путь отрезка; одиночный день — отрезок нулевой длины, круглый конец рисует его точкой. */
export const runPath = (r: SparkPt[]): string =>
  r.length === 1
    ? `M ${at(r[0])} L ${at(r[0])}`
    : r.map((p, i) => `${i ? 'L' : 'M'} ${at(p)}`).join(' ');

/** Заливка до низа холста `h` под каждым отрезком из двух дней и больше. */
export const runsArea = (runs: SparkPt[][], h: number): string =>
  runs
    .filter((r) => r.length > 1)
    .map(
      (r) =>
        `${runPath(r)} L ${fx(r[r.length - 1].x)} ${h} L ${fx(r[0].x)} ${h} Z`,
    )
    .join(' ');

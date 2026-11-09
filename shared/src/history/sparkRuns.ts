// Отрезки линии потребности (sparkline.ts): подряд идущие дни с оценкой. День без оценки линию
// рвёт: прежде он рисовался провалом до пола, то есть выдуманным нулём (ревью g2 r3). Одиночный
// день — отдельным путём точек, через пропуск — мостик без значения (ревью g2 r4).
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

const runPath = (r: SparkPt[]): string =>
  r.map((p, i) => `${i ? 'L' : 'M'} ${at(p)}`).join(' ');
const last = (r: SparkPt[]): SparkPt => r[r.length - 1];

export interface SparkPaths {
  /** Путь линии (`d`) и заливки под ней до низа холста — отрезки из двух дней и больше. */
  line: string;
  area: string;
  /** Одиночные дни: отрезок нулевой длины — круглый конец толстой обводки рисует точку. */
  singles: string;
  /** Мостики через пропуск: последний день отрезка — первый день следующего, без значения. */
  gaps: string;
  /** Сколько дней окна с оценкой нарисовано. */
  count: number;
}

/** Пути линии по точкам окна (null — день без оценки), холст высотой `h`. */
export function sparkPaths(pts: (SparkPt | null)[], h: number): SparkPaths {
  const runs = sparkRuns(pts);
  const long = runs.filter((r) => r.length > 1);
  const floor = (r: SparkPt[]) =>
    `L ${fx(last(r).x)} ${h} L ${fx(r[0].x)} ${h} Z`;
  return {
    line: long.map(runPath).join(' '),
    area: long.map((r) => `${runPath(r)} ${floor(r)}`).join(' '),
    singles: runs
      .filter((r) => r.length === 1)
      .map(([p]) => `M ${at(p)} L ${at(p)}`)
      .join(' '),
    gaps: runs
      .slice(1)
      .map((r, i) => `M ${at(last(runs[i]))} L ${at(r[0])}`)
      .join(' '),
    count: runs.reduce((s, r) => s + r.length, 0),
  };
}

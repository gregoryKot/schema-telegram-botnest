// Динамика одной потребности за неделю (лист «Динамика потребности», NeedHistorySheet):
// направление по средним трёх последних и трёх первых дней и геометрия спарклайна. Чистая
// логика отдельно от разметки — её проверяет needTrend.test.ts.

export type TrendDir = 'up' | 'down' | 'flat';

export interface NeedTrend {
  dir: TrendDir;
  /** Подпись направления, как на листе: «↑ Растёт» / «↓ Падает» / «→ Стабильно». */
  label: string;
  /** Разница средних (последние три дня минус первые три). */
  diff: number;
  /** «+2.7» / «-0.5» — разница со знаком, один знак после точки. */
  diffText: string;
  /** Среднее трёх последних дней; дней нет — 0. */
  recentAvg: number;
}

const TREND_STEP = 0.5;
const LABEL: Record<TrendDir, string> = { up: '↑ Растёт', down: '↓ Падает', flat: '→ Стабильно' };

/** `scores` — оценки от нового дня к старому (0 — день без оценки этой потребности). */
export function needTrend(scores: number[]): NeedTrend {
  const n = scores.length;
  const k = Math.min(3, n);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : 0);
  const recentAvg = avg(scores.slice(0, k));
  const olderAvg = avg(k ? scores.slice(-k) : []);
  const diff = recentAvg - olderAvg;
  const dir: TrendDir = diff > TREND_STEP ? 'up' : diff < -TREND_STEP ? 'down' : 'flat';
  return { dir, label: LABEL[dir], diff, diffText: `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}`, recentAvg };
}

export interface Spark {
  line: string;
  area: string;
  last: { x: number; y: number } | null;
  /** y точки по оценке 0–10 (0 — у самого низа). */
  yFor: (v: number) => number;
}

/** Спарклайн на холсте w×h; `values` — от старого дня к новому. */
export function sparkPaths(values: number[], w: number, h: number): Spark {
  const xStep = values.length > 1 ? w / (values.length - 1) : w / 2;
  const yFor = (v: number) => (v === 0 ? h - 2 : (h - 8) - ((v - 1) / 9) * (h - 12) + 4);
  const pts = values.map((v, i) => ({ x: i * xStep, y: yFor(v) }));
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const last = pts.length > 0 ? pts[pts.length - 1] : null;
  const area = last ? `${line} L ${last.x.toFixed(1)} ${h} L 0 ${h} Z` : '';
  return { line, area, last, yFor };
}

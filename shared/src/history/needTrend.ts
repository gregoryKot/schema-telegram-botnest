// Направление одной потребности за неделю (лист «Динамика потребности», NeedDynamics): средние
// трёх последних и трёх первых дней. Линию рисует общий sparkline.ts — тот же, что «Неделя» в
// истории; числа — fmtIndex, как индекс дня на «Готово», в истории и на плитке.
import { fmtIndexDelta } from '../needs/dayIndex';

export type TrendDir = 'up' | 'down' | 'flat';

export interface NeedTrend {
  dir: TrendDir;
  /** Подпись направления, как на листе: «↑ Растёт» / «↓ Падает» / «→ Стабильно». */
  label: string;
  /** Разница средних (последние три дня минус первые три). */
  diff: number;
  /** «+2,7» / «−0,5» — разница со знаком через fmtIndexDelta. */
  diffText: string;
  /** Среднее трёх последних дней; дней нет — 0. */
  recentAvg: number;
}

const TREND_STEP = 0.5;
const LABEL: Record<TrendDir, string> = {
  up: '↑ Растёт',
  down: '↓ Падает',
  flat: '→ Стабильно',
};

/** `scores` — оценки от нового дня к старому (0 — день без оценки этой потребности). */
export function needTrend(scores: number[]): NeedTrend {
  const k = Math.min(3, scores.length);
  const avg = (xs: number[]) =>
    xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : 0;
  const recentAvg = avg(scores.slice(0, k));
  const olderAvg = avg(k ? scores.slice(-k) : []);
  const diff = recentAvg - olderAvg;
  const dir: TrendDir =
    diff > TREND_STEP ? 'up' : diff < -TREND_STEP ? 'down' : 'flat';
  return {
    dir,
    label: LABEL[dir],
    diff,
    diffText: fmtIndexDelta(diff),
    recentAvg,
  };
}

// Направление одной потребности за неделю (лист «Динамика потребности», NeedDynamics): эта неделя
// (weekWindow от выбранного дня) против предыдущей. Ревью g2 r3: раньше брались три новых и три
// самых старых дня всей загруженной истории (~30 дней) — «к предыдущей неделе» сравнивало с
// началом месяца, а дни без оценки шли в среднее нулём и занижали его. Теперь средние — только по
// дням с оценкой; нет оценок в прошлой неделе — разницы нет (diffText null, строку сравнения лист
// не выводит), направление тогда — внутри недели: три новых дня с оценкой против трёх ранних.
// Линию рисует общий sparkline.ts; числа — fmtIndex, как индекс дня на «Готово» и в истории.
import { fmtIndexDelta } from '../needs/indexDelta';

export type TrendDir = 'up' | 'down' | 'flat';

export interface NeedTrend {
  dir: TrendDir;
  /** Подпись направления, как на листе: «↑ Растёт» / «↓ Падает» / «→ Стабильно». */
  label: string;
  /** Разница средних: неделя минус прошлая (без прошлой — новые дни недели минус ранние). */
  diff: number;
  /** «+2,7» / «−0,5» к прошлой неделе; в прошлой неделе нет оценок — null. */
  diffText: string | null;
  /** Среднее недели по дням с оценкой (сравнение недель). */
  weekAvg: number;
  /** «Сейчас» строки детства: до трёх самых новых дней недели с оценкой (как в main, ревью g2 r4). */
  recentAvg: number;
}

const TREND_STEP = 0.5;
const LABEL: Record<TrendDir, string> = {
  up: '↑ Растёт',
  down: '↓ Падает',
  flat: '→ Стабильно',
};

const avg = (xs: number[]): number => xs.reduce((s, v) => s + v, 0) / xs.length;

/**
 * `week`, `prevWeek` — оценки дней от нового к старому; 0 — день без оценки, в средние не идёт.
 * В неделе нет ни одной оценки — null: направления из пустоты не бывает.
 */
export function needTrend(
  week: number[],
  prevWeek: number[] = [],
): NeedTrend | null {
  const cur = week.filter((v) => v > 0);
  if (!cur.length) return null;
  const prev = prevWeek.filter((v) => v > 0);
  const weekAvg = avg(cur);
  const k = Math.min(3, cur.length);
  const recentAvg = avg(cur.slice(0, k));
  const diff = prev.length
    ? weekAvg - avg(prev)
    : recentAvg - avg(cur.slice(-k));
  const dir: TrendDir =
    diff > TREND_STEP ? 'up' : diff < -TREND_STEP ? 'down' : 'flat';
  return {
    dir,
    label: LABEL[dir],
    diff,
    diffText: prev.length ? fmtIndexDelta(diff) : null,
    weekAvg,
    recentAvg,
  };
}

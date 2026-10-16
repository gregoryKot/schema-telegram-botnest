import { ALL_SCHEMAS } from '../../../../shared/src/schemaTherapy/schemaTherapyData';
import type { YsqHistoryEntry } from '../../../../shared/src/apiTypes';

export interface YsqRow {
  id: string;
  name: string;
  domainId: string | null;
  pct: number;
  prevPct: number | null;
  delta: number | null;
  top: boolean;
}

export const YSQ_TOP_N = 5;
/** Выше этого процента значение подсвечивается как высокое. */
export const YSQ_HIGH_PCT = 65;

/** Строки таблицы: по убыванию «сейчас», Δ к прошлому прохождению, топ-5 помечены. */
export function buildYsqRows(latest: YsqHistoryEntry, prev: YsqHistoryEntry | null): YsqRow[] {
  const sorted = latest.scores.slice().sort((a, b) => b.pct5plus - a.pct5plus);
  return sorted.map((score, i) => {
    const meta = ALL_SCHEMAS.find(s => s.id === score.id);
    const prevScore = prev?.scores.find(x => x.id === score.id);
    const prevPct = prevScore ? prevScore.pct5plus : null;
    return {
      id: score.id,
      name: meta?.name ?? score.id,
      domainId: meta?.domainId ?? null,
      pct: score.pct5plus,
      prevPct,
      delta: prevPct != null ? score.pct5plus - prevPct : null,
      top: i < YSQ_TOP_N,
    };
  });
}

export function fmtDelta(delta: number | null): string {
  if (delta == null) return '–';
  return delta > 0 ? `+${delta}` : String(delta);
}

export function deltaClass(delta: number | null): string {
  if (delta == null || delta === 0) return 'is-zero';
  return delta < 0 ? 'is-down' : 'is-up';
}

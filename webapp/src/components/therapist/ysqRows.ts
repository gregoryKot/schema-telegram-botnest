import { ALL_SCHEMAS } from '../../../../shared/src/schemaTherapy/schemaTherapyData';
import type { YsqHistoryEntry } from '../../../../shared/src/apiTypes';
import { avgBarPct } from '../../../../shared/src/hooks/ysqScoring';
import { isServerScoreActive, sortByExpression, ysqAvgLabel } from '../../../../shared/src/therapy/ysqExpression';
import { DOMAIN_HUE, NEED_HUE } from '../../../../shared/src/theme/entityHue';
import { NEED_ORDER, type NeedId } from '../../../../shared/src/needs/types';

export interface YsqRow {
  id: string;
  name: string;
  domainId: string | null;
  /** Потребность домена (домен и потребность делят оттенок бумаги) — цвет данных полосы и линии динамики. */
  needId: NeedId | null;
  /** Средний балл 1–6 (0 — нет ответов). */
  avg: number;
  avgLabel: string;
  /** Доля ответов «5–6», %. */
  pct: number;
  /** Выражена — по флагу бэкенда, тем же критерием, что видит клиент. */
  active: boolean;
  /** Ширина бара по среднему баллу (как «Выраженные схемы» у клиента). */
  barPct: number;
  prevBarPct: number | null;
  /** Изменение среднего балла к прошлому прохождению. */
  delta: number | null;
}

export const YSQ_TOP_N = 5;

/**
 * Строки таблицы «Схемы» терапевта: выраженные первыми, внутри — по среднему
 * баллу, затем по доле «5–6»; Δ — по среднему баллу к прошлому прохождению.
 * Таблица показывает обе величины критерия, иначе схема, выраженная по
 * среднему баллу (сплошные «4»), выглядела серым 0% (QA 2026-10-26).
 */
export function buildYsqRows(latest: YsqHistoryEntry, prev: YsqHistoryEntry | null): YsqRow[] {
  return sortByExpression(latest.scores).map((score) => {
    const meta = ALL_SCHEMAS.find(s => s.id === score.id);
    const avg = score.avg ?? 0;
    const prevAvg = prev?.scores.find(x => x.id === score.id)?.avg;
    const hasPrev = prevAvg != null && prevAvg > 0;
    return {
      id: score.id,
      name: meta?.name ?? score.id,
      domainId: meta?.domainId ?? null,
      needId: domainNeedId(meta?.domainId ?? null),
      avg,
      avgLabel: ysqAvgLabel(avg),
      pct: score.pct5plus,
      active: isServerScoreActive(score),
      barPct: avgBarPct(avg),
      prevBarPct: hasPrev ? avgBarPct(prevAvg) : null,
      delta: hasPrev && avg > 0 ? Math.round((avg - prevAvg) * 10) / 10 : null,
    };
  });
}

/**
 * Потребность домена схем: домен 1 «Отчуждение» — привязанность 28, 2 — автономия 70, 3 — границы 135,
 * 4 — выражение 240, 5 — спонтанность 310 (DOMAIN_HUE и NEED_HUE — одна бумага). Полоса балла и линия динамики
 * терапевта красятся цветом данных этой потребности, как полоски результата YSQ у клиента (решение 7, b16).
 */
export function domainNeedId(domainId: string | null): NeedId | null {
  const hue = domainId ? DOMAIN_HUE[domainId] : undefined;
  return hue == null ? null : NEED_ORDER.find(n => NEED_HUE[n] === hue) ?? null;
}

export function fmtDelta(delta: number | null): string {
  if (delta == null) return '–';
  return delta > 0 ? `+${delta}` : String(delta);
}

export function deltaClass(delta: number | null): string {
  if (delta == null || delta === 0) return 'is-zero';
  return delta < 0 ? 'is-down' : 'is-up';
}

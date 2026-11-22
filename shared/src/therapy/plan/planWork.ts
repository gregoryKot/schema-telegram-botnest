// «Из плана» в итогах сессии (#1522): над какими пунктами работали и когда в последний раз.
import { formatDateString } from '../../utils/calendarDate';
import type { PlanItem } from './planItem';

export interface PlanWorkEntry {
  noteId: number;
  /** Дата записи, как у `TherapistNote.date`. */
  date: string;
  planItemIds: number[];
}

export interface PlanWorkSummary {
  count: number;
  lastDate: string;
  lastNoteId: number;
}

/** Последняя запись — с наибольшей датой (`YYYY-MM-DD` сравнивается строкой), при равных — с большим id. */
export function summarizePlanWork(
  entries: readonly PlanWorkEntry[],
): Map<number, PlanWorkSummary> {
  const out = new Map<number, PlanWorkSummary>();
  for (const e of entries) {
    for (const id of new Set(e.planItemIds)) {
      const prev = out.get(id);
      if (!prev) {
        out.set(id, { count: 1, lastDate: e.date, lastNoteId: e.noteId });
        continue;
      }
      const newer =
        e.date > prev.lastDate ||
        (e.date === prev.lastDate && e.noteId > prev.lastNoteId);
      out.set(id, {
        count: prev.count + 1,
        lastDate: newer ? e.date : prev.lastDate,
        lastNoteId: newer ? e.noteId : prev.lastNoteId,
      });
    }
  }
  return out;
}

const WORKABLE = new Set<string>(['planned', 'active']);

/** Пункты для отметки «работали»: в работе или намечены; текущая фаза первой, затем фазы по порядку пути, «без фазы» последними. */
export function planWorkCandidates(
  items: readonly PlanItem[],
  currentPhaseId: number | null,
  phaseOrder: readonly number[],
): PlanItem[] {
  const rank = (i: PlanItem): number => {
    if (i.phaseId == null || !phaseOrder.includes(i.phaseId)) return Infinity;
    if (i.phaseId === currentPhaseId) return -1;
    return phaseOrder.indexOf(i.phaseId);
  };
  return items
    .filter((i) => WORKABLE.has(i.status))
    .sort(
      (a, b) => rank(a) - rank(b) || a.position - b.position || a.id - b.id,
    );
}

function timesWord(n: number): string {
  const tail = n % 100;
  if (tail >= 11 && tail <= 14) return 'раз';
  const last = n % 10;
  if (last === 1) return 'раз';
  return last >= 2 && last <= 4 ? 'раза' : 'раз';
}

/** «работали 3 раза, последний — 12 ноября»; один раз — «работали 1 раз — 12 ноября». */
export function planWorkLine(s: PlanWorkSummary): string {
  const date = formatDateString(s.lastDate, { day: 'numeric', month: 'long' });
  const times = `${s.count} ${timesWord(s.count)}`;
  if (s.count === 1) return `работали ${times}${date && ` — ${date}`}`;
  return `работали ${times}${date && `, последний — ${date}`}`;
}

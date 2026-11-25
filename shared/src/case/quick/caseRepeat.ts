/**
 * Повтор режима для экрана «Записано»: сколько раз режим встречался в записях
 * режимов за последние две недели. Две недели — свежий повтор, а не история:
 * карта гасит режим через месяц (DORMANT_AFTER_DAYS), а при разборе раз-два в
 * неделю в окно попадает 2–4 случая — повтор уже заметен, но ещё «сейчас».
 */
import { dateStringMs } from '../../utils/calendarDate';
import { momentDayKey } from '../../utils/momentDate';

export const CASE_REPEAT_WINDOW_DAYS = 14;

export interface CaseHistoryEntry {
  modeId: string;
  /** Момент записи (полный ISO) или календарный день YYYY-MM-DD. */
  createdAt: string;
}

/**
 * Номер встречи режима с учётом только что сохранённого разбора: записи до
 * сохранения за окно + 1. Повтором считается результат от 2.
 */
export function modeRepeatCount(
  before: CaseHistoryEntry[],
  modeId: string,
  today: string,
  windowDays = CASE_REPEAT_WINDOW_DAYS,
): number {
  const todayMs = dateStringMs(today);
  if (!modeId || Number.isNaN(todayMs)) return 1;
  let count = 1;
  for (const e of before) {
    if (e.modeId !== modeId) continue;
    const dayMs = dateStringMs(momentDayKey(e.createdAt));
    if (Number.isNaN(dayMs)) continue;
    const ago = Math.round((todayMs - dayMs) / 86_400_000);
    if (ago >= 0 && ago < windowDays) count += 1;
  }
  return count;
}

// «Повторы недели»: что чаще всего повторялось за 7 дней — режим из разборов
// или низкая потребность из трекера. Чистая функция, без БД.

/** Оценка «низко»: 1–4 по шкале 0–10, 0 — «не оценено» (копия shared/src/needs/persistentLow.ts). */
export const LOW_RATING = 4;
/** Повтор — не меньше двух: одна запись ещё не повтор. */
export const MIN_REPEATS = 2;

export interface RepeatModeEntry {
  modeId: string;
  createdAt: Date;
}
export interface RepeatRating {
  needId: string;
  date: string;
  value: number;
}
export interface WeeklyRepeat {
  kind: 'mode' | 'need';
  key: string;
  count: number;
}

function top(counts: Map<string, number>): [string, number] | null {
  let best: [string, number] | null = null;
  for (const [key, n] of counts) {
    if (n >= MIN_REPEATS && (!best || n > best[1])) best = [key, n];
  }
  return best;
}

/**
 * Режим: записей этого режима; потребность: РАЗНЫХ дней с низкой оценкой.
 * Побеждает больший счёт, при равенстве — режим.
 */
export function pickWeeklyRepeat(
  modes: readonly RepeatModeEntry[],
  ratings: readonly RepeatRating[],
): WeeklyRepeat | null {
  const modeCounts = new Map<string, number>();
  for (const m of modes) {
    modeCounts.set(m.modeId, (modeCounts.get(m.modeId) ?? 0) + 1);
  }
  const lowDays = new Map<string, Set<string>>();
  for (const r of ratings) {
    if (r.value < 1 || r.value > LOW_RATING) continue;
    const days = lowDays.get(r.needId) ?? new Set<string>();
    days.add(r.date);
    lowDays.set(r.needId, days);
  }
  const needCounts = new Map<string, number>();
  for (const [needId, days] of lowDays) needCounts.set(needId, days.size);

  const mode = top(modeCounts);
  const need = top(needCounts);
  if (mode && (!need || mode[1] >= need[1])) {
    return { kind: 'mode', key: mode[0], count: mode[1] };
  }
  return need ? { kind: 'need', key: need[0], count: need[1] } : null;
}

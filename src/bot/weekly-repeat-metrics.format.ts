// Блок «Повторы недели» для /stats (правило №8). Чистый форматтер.
export interface WeeklyRepeatMetrics {
  /** За месяц: поставлено в очередь уведомлений «Повторы недели». */
  total: number;
  mode: number;
  need: number;
}

export const EMPTY_WEEKLY_REPEAT_METRICS: WeeklyRepeatMetrics = {
  total: 0,
  mode: 0,
  need: 0,
};

/** Текстовый блок для /stats. Язык без терминов. */
export function formatWeeklyRepeatMetrics(m: WeeklyRepeatMetrics): string {
  const head = '🔁 <b>Повторы недели</b> (за месяц)';
  if (m.total === 0) return `${head}\nПока ничего не поставлено в очередь`;
  return `${head}\nПоставлено в очередь ${m.total} (режимы ${m.mode}, потребности ${m.need})`;
}

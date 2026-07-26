// Чистый форматтер retention-блока /stats + его типы. Вынесено из
// bot.analytics.service.ts (правило №10, конвенция *.format.ts). Покрыто
// тестом bot.analytics.retention.spec.ts.

export interface RetentionPoint {
  cohort: number;
  retained: number;
}
export interface RetentionStats {
  d1: RetentionPoint;
  d7: RetentionPoint;
  d30: RetentionPoint;
  funnel: { registered30: number; consented30: number; filledOnce30: number };
}

/** Блок для /stats — чистая функция, покрыта тестом. */
export function formatRetentionBlock(s: RetentionStats): string {
  const pct = (p: RetentionPoint) =>
    p.cohort === 0
      ? '—'
      : `${Math.round((p.retained / p.cohort) * 100)}% (${p.retained}/${p.cohort})`;
  const f = s.funnel;
  const fp = (n: number) =>
    f.registered30 === 0 ? '' : ` (${Math.round((n / f.registered30) * 100)}%)`;
  return [
    `📉 <b>Возвращаются ли новенькие</b>`,
    `(заходят ли снова на 1-й, 7-й и 30-й день после первого раза)`,
    `D1: ${pct(s.d1)} · D7: ${pct(s.d7)} · D30: ${pct(s.d30)}`,
    '',
    `🚪 <b>Первые шаги новичка</b> (кто дошёл до какого шага за месяц)`,
    `Регистрация: ${f.registered30}`,
    `→ Приняли согласие: ${f.consented30}${fp(f.consented30)}`,
    `→ Заполнили трекер хоть раз: ${f.filledOnce30}${fp(f.filledOnce30)}`,
  ].join('\n');
}

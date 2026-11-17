// Блок «План работы с клиентом» для /stats (правило №8: событие, которого нет в отчёте,
// невидимо). Чистый форматтер, покрыт тестом, включая пустую БД; язык простой.
import type { PlanMetrics } from './plan-metrics.types';

/** Текстовый блок для /stats. Чистая функция. */
export function formatPlanMetrics(m: PlanMetrics): string {
  const lines = ['🗂 <b>План работы с клиентом</b> (за месяц)'];
  if (m.added30 === 0 && m.active30 === 0 && m.done30 === 0) {
    lines.push('Пока никто из терапевтов не добавлял пункты в план.');
    return lines.join('\n');
  }
  if (m.added30 > 0) {
    const own = m.added30 - m.fromGuide30;
    const parts = [
      m.fromGuide30 > 0 && `из справочника — ${m.fromGuide30}`,
      own > 0 && `своих — ${own}`,
    ].filter(Boolean);
    lines.push(
      `Добавлено пунктов: ${m.added30} (${parts.join(', ')}), терапевтов: ${m.therapists30}`,
    );
  }
  const marks = [
    m.active30 > 0 && `«в работе» — ${m.active30}`,
    m.done30 > 0 && `«сделано» — ${m.done30}`,
  ].filter(Boolean);
  lines.push(
    marks.length > 0
      ? `Отмечено ${marks.join(', ')}`
      : 'Ни один пункт пока не отмечали «в работе» или «сделано»',
  );
  return lines.join('\n');
}

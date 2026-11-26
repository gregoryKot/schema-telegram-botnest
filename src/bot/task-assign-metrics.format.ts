// Блок «Задания клиентам» для /stats (правило №8: событие, которого нет в отчёте, невидимо).
// Чистый форматтер, покрыт тестом, включая пустую БД; язык простой.
import type { TaskAssignMetrics } from './task-assign-metrics.types';

/** Текстовый блок для /stats. Чистая функция. */
export function formatTaskAssignMetrics(m: TaskAssignMetrics): string {
  const lines = ['📌 <b>Задания клиентам</b> (за месяц)'];
  const total = m.tile30 + m.catalog30 + m.custom30 + m.guide30 + m.template30;
  if (total === 0) {
    lines.push('Пока никто из терапевтов не назначал задания.');
    return lines.join('\n');
  }
  const parts = [
    m.tile30 > 0 && `упражнения приложения — ${m.tile30}`,
    m.catalog30 > 0 && `из справочника — ${m.catalog30}`,
    m.custom30 > 0 && `свой текст — ${m.custom30}`,
    m.guide30 > 0 && `«Дать заданием» из справочника — ${m.guide30}`,
    m.template30 > 0 && `из шаблона — ${m.template30}`,
  ].filter(Boolean);
  lines.push(`Назначено заданий: ${total} (${parts.join(', ')})`);
  return lines.join('\n');
}

// Блок «Путь клиента» для /stats (правило №8: событие, которого нет в отчёте, невидимо).
// Чистый форматтер, покрыт тестом, включая пустую БД; язык простой.
import type { PathMetrics } from './path-metrics.types';

const ROWS: [keyof PathMetrics, string][] = [
  ['created30', 'Путей собрано'],
  ['drafts30', 'Черновиков собрано'],
  ['phasesStarted30', 'Фаз начато'],
  ['phasesFinished30', 'Фаз завершено'],
  ['sessionsMarked30', 'Итогов сессий с пунктами плана'],
  ['shifted30', 'Раз сдвигали сроки'],
];

/** Текстовый блок для /stats. Чистая функция. */
export function formatPathMetrics(m: PathMetrics): string {
  const lines = ['🧭 <b>Путь клиента</b> (за месяц)'];
  const filled = ROWS.filter(([key]) => m[key] > 0);
  if (filled.length === 0) {
    lines.push('Пока никто не собирал путь.');
    return lines.join('\n');
  }
  for (const [key, label] of filled) lines.push(`${label}: ${m[key]}`);
  return lines.join('\n');
}

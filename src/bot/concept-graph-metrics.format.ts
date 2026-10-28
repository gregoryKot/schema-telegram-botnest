// Блок «Графическая концептуализация» для /stats (правило №8: событие, которого нет в
// отчёте, невидимо). Чистый форматтер, покрыт тестом, включая пустую БД; язык простой.
import type { ConceptGraphMetrics } from './concept-graph-metrics.types';

/** Текстовый блок для /stats. Чистая функция. */
export function formatConceptGraphMetrics(m: ConceptGraphMetrics): string {
  const lines = [`🧩 <b>Графическая концептуализация</b> (за месяц)`];
  if (Object.values(m).every((n) => n === 0)) {
    lines.push('Пока никто из терапевтов не открывал схему случая по режимам.');
    return lines.join('\n');
  }
  lines.push(`Открывали ${m.opens30} раз, терапевтов: ${m.therapists30}`);
  lines.push(
    m.linked30 > 0
      ? `Связи режимов заполняли ${m.linked30} раз`
      : 'Связи режимов пока не заполняли',
  );
  if (m.schemaLinked30 > 0) {
    lines.push(`Убеждения и опыт схем записывали ${m.schemaLinked30} раз`);
  }
  if (m.canvasOpen30 > 0) {
    lines.push(`Переносили схему случая на холст ${m.canvasOpen30} раз`);
  }
  if (m.fullscreen30 > 0) {
    lines.push(`Разворачивали схему на весь экран ${m.fullscreen30} раз`);
  }
  if (m.saveRetry30 > 0) {
    lines.push(`Повторяли сохранение после ошибки ${m.saveRetry30} раз`);
  }
  return lines.join('\n');
}

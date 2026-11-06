// Блок «Графическая концептуализация» для /stats (правило №8: событие, которого нет в
// отчёте, невидимо). Чистый форматтер, покрыт тестом, включая пустую БД; язык простой.
import type { ConceptGraphMetrics } from './concept-graph-metrics.types';

// Строки, которые видны, только если событие было: «0 раз» отчёт не печатает.
const IF_ANY: [keyof ConceptGraphMetrics, (n: number) => string][] = [
  ['schemaLinked30', (n) => `Убеждения и опыт схем записывали ${n} раз`],
  ['canvasOpen30', (n) => `Собирали карту из концептуализации ${n} раз`],
  ['fullscreen30', (n) => `Разворачивали схему на весь экран ${n} раз`],
  ['saveRetry30', (n) => `Повторяли сохранение после ошибки ${n} раз`],
  ['brief30', (n) => `Открывали «Главное» на одном экране ${n} раз`],
  ['syncToMap30', (n) => `Дописывали на карту из полей: ${n} раз`],
  ['syncFromMap30', (n) => `Холст дописывал в концептуализацию: ${n} раз`],
];

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
  for (const [key, line] of IF_ANY) {
    if (m[key] > 0) lines.push(line(m[key]));
  }
  return lines.join('\n');
}

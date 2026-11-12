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
  ['needsRated30', (n) => `Колесо потребностей на холсте заполняли ${n} раз`],
];
// Подсказки терапевту (#995): одной строкой, нулевые части не печатаются.
const GUIDE: [keyof ConceptGraphMetrics, string][] = [
  ['guideModes30', 'листы режимов'],
  ['guideSchemas30', 'листы схем'],
  ['guideTechniques30', 'листы техник'],
  ['guideAssign30', '«Дать заданием»'],
  ['guideMarkDone30', 'отметили техник'],
  ['guideJournalOpen30', 'переходили в журнал техник'],
  ['guideJournalEntry30', 'открывали технику из журнала'],
];

/**
 * Показ схемы случая клиенту (тумблер «Показать клиенту», «Мой терапевт»):
 * строки только про то, что было, — без «0 раз». Чистая функция.
 */
export function conceptShareLines(m: ConceptGraphMetrics): string[] {
  const lines: string[] = [];
  if (m.sharedNow > 0)
    lines.push(`Схему случая сейчас видят клиенты: ${m.sharedNow}`);
  if (m.shareOn30 > 0)
    lines.push(`Терапевты включали показ схемы клиенту: ${m.shareOn30} раз`);
  if (m.shareOff30 > 0) lines.push(`Выключали показ: ${m.shareOff30} раз`);
  if (m.clientOpens30 > 0)
    lines.push(
      `Клиенты смотрели свою схему ${m.clientOpens30} раз, клиентов: ${m.clientOpeners30}`,
    );
  return lines;
}

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
  const guide = GUIDE.filter(([k]) => m[k] > 0).map(
    ([k, label]) => `${label}: ${m[k]}`,
  );
  lines.push(
    guide.length > 0
      ? `Подсказки терапевту — ${guide.join(', ')}`
      : 'Подсказки терапевту пока не открывали',
  );
  lines.push(...conceptShareLines(m));
  return lines.join('\n');
}

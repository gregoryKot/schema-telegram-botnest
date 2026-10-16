// Блок «Графическая концептуализация» для /stats (правило №8: событие, которого нет в
// отчёте, невидимо). Чистый форматтер, покрыт тестом, включая пустую БД; язык простой.
export interface ConceptGraphMetrics {
  opens30: number; // за месяц: сколько раз терапевты открыли схему случая по режимам
  therapists30: number; // за месяц: сколько разных терапевтов её открывало
  linked30: number; // за месяц: сколько раз заполнили связи режима (схемы, потребности, истоки)
  schemaLinked30: number; // за месяц: сколько раз записали убеждение / детский опыт / потребности схемы
  canvasOpen30: number; // за месяц: сколько раз схему случая перенесли на холст (создана карта режимов)
}

/** Текстовый блок для /stats. Чистая функция. */
export function formatConceptGraphMetrics(m: ConceptGraphMetrics): string {
  const lines = [`🧩 <b>Графическая концептуализация</b> (за месяц)`];
  if (m.opens30 + m.linked30 + m.schemaLinked30 + m.canvasOpen30 === 0) {
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
  return lines.join('\n');
}

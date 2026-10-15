// Блок «Графическая концептуализация» для /stats (правило №8: событие, которого
// нет в отчёте, — невидимо). Чистый форматтер, покрыт тестом, включая пустую
// БД. Язык — простой: «открывали», «заполняли связи», а не «concept_graph_open».

export interface ConceptGraphMetrics {
  /** За месяц: сколько раз терапевты открыли схему случая по режимам. */
  opens30: number;
  /** За месяц: сколько разных терапевтов её открывало. */
  therapists30: number;
  /** За месяц: сколько раз заполнили связи режима (схемы, потребности, истоки). */
  linked30: number;
  /** За месяц: сколько раз записали убеждение / детский опыт / потребности схемы. */
  schemaLinked30: number;
}

/** Текстовый блок для /stats. Чистая функция. */
export function formatConceptGraphMetrics(m: ConceptGraphMetrics): string {
  const lines = [`🧩 <b>Графическая концептуализация</b> (за месяц)`];
  if (m.opens30 === 0 && m.linked30 === 0 && m.schemaLinked30 === 0) {
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
  return lines.join('\n');
}

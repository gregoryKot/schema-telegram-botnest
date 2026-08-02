// Блок «Дневник режимов» для /stats (правило №8). Чистый форматтер, тест
// включая пустую БД. Язык простой: «записей в дневнике», а не «events».

export interface ModeDiaryMetrics {
  /** Записей за неделю. */
  saves7: number;
  /** Записей за месяц. */
  saves30: number;
  /** Из месячных — со словами Здорового Взрослого. */
  withHealthy30: number;
  /** Сколько раз тест «по функции» определил режим за неделю. */
  testCompleted7: number;
  /** За месяц. */
  testCompleted30: number;
}

/** Текстовый блок для /stats. Чистая функция. */
export function formatModeDiaryMetrics(m: ModeDiaryMetrics): string {
  const lines = [`📓 <b>Дневник режимов</b> (за неделю/месяц)`];
  if (m.saves30 === 0 && m.testCompleted30 === 0) {
    lines.push('Пока никто не вёл дневник режимов и не проходил тест.');
    return lines.join('\n');
  }
  lines.push(`Записей за неделю: ${m.saves7} · за месяц: ${m.saves30}`);
  if (m.saves30 > 0) {
    lines.push(
      `Из них дописывали ответ Здорового Взрослого: ${m.withHealthy30}`,
    );
  }
  if (m.testCompleted30 > 0) {
    lines.push(
      `Определяли режим тестом за неделю: ${m.testCompleted7} · за месяц: ${m.testCompleted30}`,
    );
  }
  return lines.join('\n');
}

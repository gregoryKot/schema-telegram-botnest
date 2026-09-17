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
  /** За месяц: сколько раз после записи согласились разобрать связанный режим. */
  chainAccepted30: number;
  /** За месяц: сколько раз открыли «С чем путают режим» с карточки выбранного. */
  doubtOpened30: number;
  /** За месяц: сколько раз из открытых поменяли выбор кнопкой «Это ближе». */
  doubtSwitched30: number;
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
  lines.push(
    m.chainAccepted30 > 0
      ? `Разбирали связанный режим после записи: ${m.chainAccepted30}`
      : 'Связанный режим после записи пока не разбирали.',
  );
  lines.push(
    m.doubtOpened30 > 0
      ? `Сравнивали похожие режимы ${m.doubtOpened30} раз, из них ${m.doubtSwitched30} — поменяли выбор.`
      : 'Похожие режимы пока не сравнивали.',
  );
  return lines.join('\n');
}

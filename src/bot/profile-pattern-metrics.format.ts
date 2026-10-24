// Блок «Паттерны со вкладки «Я»» для /stats (правило №8: событие, которого
// нет в отчёте, — невидимо). Чистый форматтер, покрыт тестом, включая пустую
// БД. Язык — простой: «открывали схемы», а не «profile_pattern_open events».

export interface ProfilePatternMetrics {
  /** За месяц: сколько раз со вкладки «Я» открыли лист схемы. */
  schemaOpens30: number;
  /** За месяц: сколько раз со вкладки «Я» открыли лист режима. */
  modeOpens30: number;
}

/** Текстовый блок для /stats. Чистая функция. */
export function formatProfilePatternMetrics(m: ProfilePatternMetrics): string {
  const lines = [`🪞 <b>Паттерны со вкладки «Я»</b> (за месяц)`];
  if (m.schemaOpens30 === 0 && m.modeOpens30 === 0) {
    lines.push('Пока никто не открывал схемы или режимы со вкладки «Я».');
    return lines.join('\n');
  }
  lines.push(
    `Из вкладки «Я» открывали схемы ${m.schemaOpens30} раз, режимы ${m.modeOpens30} раз`,
  );
  return lines.join('\n');
}

// Блок «Тёплые слова» для /stats (правило №8: событие, которого нет в
// отчёте, — невидимо). Чистый форматтер, покрыт тестом, включая пустую БД.
// Язык — простой: «открывали свои тёплые слова», а не «warm_words_open events».

export interface WarmWordsMetrics {
  /** За месяц: сколько раз открыли раздел «Тёплые слова». */
  opens30: number;
  /** За месяц: у скольких разных людей это было. */
  users30: number;
}

/** Текстовый блок для /stats. Чистая функция. */
export function formatWarmWordsMetrics(m: WarmWordsMetrics): string {
  const lines = [`💛 <b>Тёплые слова</b> (за месяц)`];
  if (m.opens30 === 0) {
    lines.push('Пока никто не заглядывал в свои тёплые слова.');
    return lines.join('\n');
  }
  lines.push(
    `Открывали свои тёплые слова: ${m.opens30} раз (${m.users30} человек)`,
  );
  return lines.join('\n');
}

// Блок «Карточки режимов» для /stats (правило №8: событие, которого нет в
// отчёте, — невидимо). Чистый форматтер, покрыт тестом, включая пустую БД.
// Язык — простой: «карточек заполнено», а не «mode_card_saved events».

export interface ModeCardMetrics {
  /** За месяц: сколько раз сохранили карточку режима. */
  saved30: number;
  /** За месяц: у скольких разных людей это было. */
  users30: number;
  /** Среднее число заполненных полей карточки (0..7) за месяц. */
  avgFilled30: number;
}

/** Текстовый блок для /stats. Чистая функция. */
export function formatModeCardMetrics(m: ModeCardMetrics): string {
  const lines = [`🧩 <b>Карточки режимов</b> (за месяц)`];
  if (m.saved30 === 0) {
    lines.push('Пока никто не заполнял карточку режима.');
    return lines.join('\n');
  }
  lines.push(
    `Карточек режимов заполнено: ${m.saved30} (у ${m.users30} человек), ` +
      `в среднем полей — ${m.avgFilled30.toFixed(1)} из 7`,
  );
  return lines.join('\n');
}

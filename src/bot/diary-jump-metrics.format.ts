// Блок «Переходы из «Записей»» для /stats (правило №8). Чистый форматтер,
// покрыт тестом, включая пустую БД. Язык простой: «к карточке», «к трекеру».

export interface DiaryJumpMetrics {
  /** За месяц: переходы из записи к карточке схемы/режима. */
  pattern30: number;
  /** За месяц: переходы к проверке состояния (трекеру). */
  tracker30: number;
  /** За месяц: переходы к разбору «Что случилось». */
  case30: number;
}

/** Текстовый блок для /stats. Чистая функция. */
export function formatDiaryJumpMetrics(m: DiaryJumpMetrics): string {
  const lines = [`📖 <b>Переходы из «Записей»</b> (за месяц)`];
  if (m.pattern30 === 0 && m.tracker30 === 0 && m.case30 === 0) {
    lines.push(
      'Пока никто не переходил из «Записей» к карточкам, трекеру или разбору.',
    );
    return lines.join('\n');
  }
  lines.push(
    `К карточке схемы или режима ${m.pattern30}, к трекеру ${m.tracker30}, к разбору ${m.case30}`,
  );
  return lines.join('\n');
}

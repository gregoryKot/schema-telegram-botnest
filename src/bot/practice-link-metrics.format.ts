// Блок «Переходы к автору-терапевту» для /stats (правило №8: событие, которого
// нет в отчёте, — невидимо). Чистый форматтер, покрыт тестом, включая пустую
// БД. Язык — простой: «из блока об авторе», а не сырые ключи события.

export interface PracticeLinkMetrics {
  /** За месяц: все переходы на сайт практики с продуктового лендинга. */
  total30: number;
  /** Разбивка по месту клика (meta.place). */
  author30: number;
  footer30: number;
  faq30: number;
}

/** Текстовый блок для /stats. Чистая функция. */
export function formatPracticeLinkMetrics(m: PracticeLinkMetrics): string {
  const lines = [`👤 <b>Переходы к автору-терапевту</b> (за месяц)`];
  if (m.total30 === 0) {
    lines.push('Пока никто не переходил на сайт практики.');
    return lines.join('\n');
  }
  lines.push(
    `Переходили на сайт практики: ${m.total30} ` +
      `(из блока об авторе — ${m.author30}, из подвала — ${m.footer30}, ` +
      `из вопросов — ${m.faq30})`,
  );
  return lines.join('\n');
}

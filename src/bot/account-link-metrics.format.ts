// Блок «Перенос данных из другого приложения» для /stats (правило №8: событие,
// которого нет в отчёте, — невидимо). Чистый форматтер, покрыт тестом, включая
// пустую БД.
//
// Язык простой: «начинали переносить», а не «account_link_started events».
// Важен именно разрыв между «начали» и «довели до конца»: путь идёт через
// внешний браузер, и если люди отваливаются посередине — это видно только тут.

export interface AccountLinkMetrics {
  /** За месяц: сколько раз начинали перенос из мессенджера. */
  started30: number;
  /** За месяц: сколько разных людей начинали. */
  startedUsers30: number;
  /** За месяц: сколько раз подтвердили в браузере. */
  confirmed30: number;
  /** Из подтверждённых — сколько реально что-то перенесли (а не тот же аккаунт). */
  merged30: number;
  /** За месяц: сколько раз не вышло (код протух или ошибка). */
  failed30: number;
}

const plural = (n: number, one: string, few: string, many: string): string =>
  n % 10 === 1 && n % 100 !== 11
    ? one
    : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14)
      ? few
      : many;

/** Текстовый блок для /stats. Чистая функция. */
export function formatAccountLinkMetrics(m: AccountLinkMetrics): string {
  const lines = [`🔗 <b>Перенос данных из другого приложения</b> (за месяц)`];
  if (m.started30 === 0 && m.confirmed30 === 0) {
    lines.push('Пока никто не переносил данные из другого мессенджера.');
    return lines.join('\n');
  }

  const people = `${m.startedUsers30} ${plural(m.startedUsers30, 'человек', 'человека', 'человек')}`;
  lines.push(`Начинали переносить: ${m.started30} раз (${people})`);
  lines.push(`Довели до конца: ${m.confirmed30}`);
  if (m.merged30 !== m.confirmed30) {
    // Подтвердить можно и под тем же аккаунтом — тогда переносить нечего.
    lines.push(`Из них с реальным переносом данных: ${m.merged30}`);
  }
  if (m.failed30 > 0) {
    lines.push(`Не получилось: ${m.failed30}`);
  }

  const lost = m.started30 - m.confirmed30 - m.failed30;
  if (lost > 0) {
    lines.push(`Начали и пропали по дороге: ${lost}`);
  }
  return lines.join('\n');
}

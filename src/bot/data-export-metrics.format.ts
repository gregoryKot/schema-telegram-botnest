import { plural } from './plural';

// Блок «Забирают свои данные» для /stats (правило №8). Событие data_export —
// человек нажал «Скачать мои данные» (152-ФЗ/GDPR, GET /api/account/export).
// Чистый форматтер, покрыт тестом, включая пустую БД.
//
// Зачем блок: эндпоинт не проверить «на глаз» — он либо молча отдаёт всё, либо
// молча ломается на части таблиц. Рост числа выгрузок или тишина месяцами —
// оба сигнала стоит видеть заранее. Окно — всё время: pruneOld событие не
// удаляет (KEPT_UNTIL_ACCOUNT_DELETION), оно уходит только с аккаунтом.

export interface DataExportMetrics {
  /** Сколько раз выгружали за всё время (у живых аккаунтов). */
  totalExports: number;
  /** Сколько разных людей выгружали за всё время. */
  totalUsers: number;
  /** За последние 30 дней. */
  exports30: number;
  users30: number;
  /** Сколько дней назад была последняя выгрузка. 0 — сегодня. */
  daysSinceLast: number;
}

function lastSeenLabel(days: number): string {
  if (days <= 0) return 'сегодня';
  if (days === 1) return 'вчера';
  return `${days} ${plural(days, 'день', 'дня', 'дней')} назад`;
}

/** Текстовый блок для /stats. Чистая функция. */
export function formatDataExportMetrics(m: DataExportMetrics): string {
  const lines = ['📤 <b>Забирают свои данные</b>'];
  const period = 'За всё время';
  if (m.totalExports === 0) {
    lines.push(`${period} выгрузку данных никто не запрашивал.`);
    return lines.join('\n');
  }
  lines.push(
    `${period} забирали данные ${m.totalExports} ${plural(m.totalExports, 'раз', 'раза', 'раз')} — ` +
      `${m.totalUsers} ${plural(m.totalUsers, 'человек', 'человека', 'человек')}.`,
  );
  if (m.exports30 > 0) {
    lines.push(
      `За последний месяц: ${m.exports30} ${plural(m.exports30, 'раз', 'раза', 'раз')}, ` +
        `${m.users30} ${plural(m.users30, 'человек', 'человека', 'человек')}.`,
    );
  } else {
    lines.push('За последний месяц — ни разу.');
  }
  lines.push(`Последний раз — ${lastSeenLabel(m.daysSinceLast)}.`);
  return lines.join('\n');
}

import { plural } from './plural';

// Блок «Забирают свои данные» для /stats (правило №8: событие, которого нет
// в отчёте, — невидимо). Считает событие data_export — человек нажал
// «Скачать мои данные» (право на доступ по 152-ФЗ/GDPR, GET
// /api/account/export). Чистый форматтер, покрыт тестом, включая пустую БД.
//
// Зачем блок вообще есть: эндпоинт нельзя проверить «на глаз» — он либо
// молча отдаёт всё, либо молча ломается на части таблиц. Резкий рост числа
// выгрузок или полная тишина месяцами — оба сигнала стоит видеть заранее,
// а не только когда придёт официальный запрос на доступ к данным.
//
// Язык простой: «забрали данные N раз», а не «data_export events».

export interface DataExportMetrics {
  /** Сколько раз всего выгружали (за всё время). */
  totalExports: number;
  /** Сколько разных людей хоть раз выгружали. */
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
  if (m.totalExports === 0) {
    lines.push('Пока никто не запрашивал выгрузку данных.');
    return lines.join('\n');
  }
  lines.push(
    `Всего забирали данные ${m.totalExports} ${plural(m.totalExports, 'раз', 'раза', 'раз')} — ` +
      `${m.totalUsers} ${plural(m.totalUsers, 'человек', 'человека', 'человек')} за всё время.`,
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

// Блок «Справочник терапевта» для /stats (правило №8: событие, которого нет в отчёте, невидимо). Чистый форматтер, покрыт тестом, включая пустую БД; язык простой.
import type { GuideReferenceMetrics } from './guide-reference-metrics.types';

// Что открывали из «Справочника»: одной строкой, нулевые части не печатаются.
const SHEETS: [keyof GuideReferenceMetrics, string][] = [
  ['modes30', 'режимы'],
  ['schemas30', 'схемы'],
  ['needs30', 'потребности'],
  ['techniques30', 'техники'],
  ['notes30', '«Для терапевта»'],
  ['concerns30', 'запросы и расстройства'],
  ['phases30', 'путь терапии'],
];

/** Текстовый блок для /stats. Чистая функция. */
export function formatGuideReferenceMetrics(m: GuideReferenceMetrics): string {
  const lines = ['📖 <b>Справочник терапевта</b> (за месяц)'];
  if (m.opens30 === 0) {
    lines.push('Пока никто из терапевтов не открывал справочник в меню.');
    return lines.join('\n');
  }
  lines.push(`Открывали ${m.opens30} раз, терапевтов: ${m.therapists30}`);
  const sheets = SHEETS.filter(([k]) => m[k] > 0).map(
    ([k, label]) => `${label}: ${m[k]}`,
  );
  lines.push(
    sheets.length > 0
      ? `Читали оттуда — ${sheets.join(', ')}`
      : 'Ни одного листа оттуда пока не открывали',
  );
  if (m.tables30 > 0) lines.push(`Общую таблицу схем открывали: ${m.tables30}`);
  return lines.join('\n');
}

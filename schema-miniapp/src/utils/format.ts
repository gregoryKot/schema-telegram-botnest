const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const MONTHS_LONG  = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

/** "7 апр" from "2026-04-07" — safe, no timezone shift */
export function fmtDate(dateStr: string): string {
  const [, m, d] = dateStr.split('-');
  return `${parseInt(d)} ${MONTHS_SHORT[parseInt(m) - 1]}`;
}

/** "7 апреля" from "2026-04-07" — safe, no timezone shift */
export function fmtDateLong(dateStr: string): string {
  const [, m, d] = dateStr.split('-');
  return `${parseInt(d)} ${MONTHS_LONG[parseInt(m) - 1]}`;
}

/** YYYY-MM-DD for today in the local browser timezone */
export function todayStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

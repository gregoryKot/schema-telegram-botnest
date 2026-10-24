// Текст для экрана календаря слотов: форматирование дат и слова-состояния.
// Вынесено из calendarModel.ts (тот держит переходы состояний и арифметику
// окна недели), чтобы ни один файл не перевалил потолок ~150 строк (правило
// №10 CLAUDE.md). Чистые функции, без React, без побочных эффектов.
import { dateStringParts } from '../../../../../shared/src/utils/calendarDate';
import type { AdminCalendarCell, AdminCalendarCellState } from '../../../api';

const DAYS_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']; // индекс = dateStringParts().weekday
const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const MONTHS_GENITIVE = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

/** 'HH:mm' времени старта ячейки в зоне правил (startsAt — момент, не календарный день). */
export function fmtChipTime(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat('ru-RU', { timeZone: timezone, hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

/** «Пн 21 сен» — свой формат вместо Intl: короткий месяц у Intl идёт с точкой («сент.»). */
export function fmtDayTitle(dateStr: string): string {
  const p = dateStringParts(dateStr);
  if (!p) return '';
  return `${DAYS_SHORT[p.weekday]} ${p.day} ${MONTHS_SHORT[p.month - 1]}`;
}

/** «21–27 сентября» внутри месяца, «28 сентября – 4 октября» на стыке. */
export function fmtWeekTitle(from: string, to: string): string {
  const a = dateStringParts(from);
  const b = dateStringParts(to);
  if (!a || !b) return '';
  if (a.month === b.month && a.year === b.year) return `${a.day}–${b.day} ${MONTHS_GENITIVE[a.month - 1]}`;
  return `${a.day} ${MONTHS_GENITIVE[a.month - 1]} – ${b.day} ${MONTHS_GENITIVE[b.month - 1]}`;
}

const STATE_LABELS: Record<AdminCalendarCellState, string> = {
  free: 'свободно',
  busy: 'встреча в календаре',
  booked: 'бронь',
  blocked: 'закрыто вручную',
  extra: 'открыто вручную',
  off: 'вне расписания',
};

/** Слово-состояние для aria-label чипа и подписи в легенде. */
export function stateLabel(state: AdminCalendarCellState): string {
  return STATE_LABELS[state];
}

/**
 * Слово-состояние конкретной ячейки для aria-label чипа: у прошедшей
 * НЕ-booked ячейки состояние (свободно/занято/…) уже ничего не значит для
 * клиента — вместо него факт «прошло». Booked в прошлом остаётся «бронь»:
 * это история дня, а не предложение записи.
 */
export function chipLabel(cell: AdminCalendarCell): string {
  return cell.past && cell.state !== 'booked' ? 'прошло' : stateLabel(cell.state);
}

/**
 * Подпись в шапке карточки дня. Пустой день — пустая строка (DayCard сам
 * рисует «Ячеек нет»). День, целиком ушедший в прошлое, — «прошло»: счётчик
 * свободных мест про прошлое ничего не говорит, а «свободных нет» там
 * читается как поломка, а не как факт (наблюдение владельца 2026-09-20).
 */
export function dayStatus(cells: AdminCalendarCell[]): string {
  if (cells.length === 0) return '';
  if (cells.every((c) => c.past)) return 'прошло';
  const free = cells.filter((c) => (c.state === 'free' || c.state === 'extra') && !c.past).length;
  return free > 0 ? `${free} свободно` : 'свободных нет';
}

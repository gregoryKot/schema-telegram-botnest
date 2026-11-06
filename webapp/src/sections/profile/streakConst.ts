import { dateStringParts } from '../../../../shared/src/utils/calendarDate';

export const DOW_SHORT = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];

/** Номер дня недели с понедельника (0=пн … 6=вс) для дня `YYYY-MM-DD`;
 *  нечитаемая строка — -1 (подсветки нет). Считается от переданного дня, а не
 *  при загрузке модуля: константа TODAY_DOW_IDX у открытой через полночь
 *  страницы подсвечивала вчера (docs/open/frontend-ux.md). */
export function mondayIndexOf(day: string): number {
  const parts = dateStringParts(day);
  return parts ? (parts.weekday + 6) % 7 : -1;
}

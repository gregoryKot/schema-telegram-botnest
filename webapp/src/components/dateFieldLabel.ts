import { fmtDateLong, todayStr } from '../utils/format';

/** Подпись поля даты: «26 ноября», год — только не текущий у смотрящего; пусто — «Выбрать дату». */
export function dateFieldLabel(dateStr: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return 'Выбрать дату';
  const year = dateStr.slice(0, 4);
  const base = fmtDateLong(dateStr);
  return year === todayStr().slice(0, 4) ? base : `${base} ${parseInt(year)}`;
}

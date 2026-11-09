import { NEED_COLOR_ORDER } from '../../../../shared/src/needs/needColors';
import { isRated } from '../../../../shared/src/needs/ratingRecord';

/**
 * Оценки дня для полосок главной (`Strokes values`, docs/design/APP_2026-11.md, b05): по одной на
 * потребность в порядке NEED_ORDER; без оценки (нет ключа или 0) — null, полоска встаёт пустым
 * тоном бумаги, а не выдуманной высотой.
 */
export function strokeValues(ratings: Readonly<Record<string, number>>): (number | null)[] {
  return NEED_COLOR_ORDER.map((id) => (isRated(ratings, id) ? ratings[id] : null));
}

import { NEED_COLOR_ORDER } from './needColors';
import { isRated } from './ratingRecord';

/**
 * Оценки дня для полосок `Strokes values` (главная «Сегодня» и карточка дня в меню кабинета,
 * docs/design/APP_2026-11.md, b04 и b05): по одной на потребность в порядке NEED_ORDER; без оценки
 * (нет ключа или 0) — null, полоска встаёт пустым тоном бумаги, а не выдуманной высотой. Одна функция
 * на оба места: полоски в меню и на главной не расходятся.
 */
export function dayStrokeValues(
  ratings: Readonly<Record<string, number>>,
): (number | null)[] {
  return NEED_COLOR_ORDER.map((id) =>
    isRated(ratings, id) ? ratings[id] : null,
  );
}

import { NEED_COLOR_ORDER } from './needColors';
import { isRated } from './ratingRecord';

/**
 * Оценки дня для полосок `Strokes values` (главная «Сегодня», карточка дня в меню кабинета, лента
 * дат и лист «Заполнить этот день» в истории — docs/design/APP_2026-11.md, b04, b05, b08): по одной
 * на потребность в порядке NEED_ORDER; без оценки (нет ключа или 0) — null, полоска встаёт пустым
 * тоном бумаги, а не выдуманной высотой. Одна функция на все места: полоски не расходятся.
 */
export function dayStrokeValues(
  ratings: Readonly<Record<string, number>>,
): (number | null)[] {
  return NEED_COLOR_ORDER.map((id) =>
    isRated(ratings, id) ? ratings[id] : null,
  );
}

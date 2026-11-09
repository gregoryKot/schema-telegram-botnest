// Полоски «сегодняшнего листа» SceneCheckIn там, где они значат оценки дня (праздник серии, «Карточка
// недели» в истории): пять потребностей в порядке NEED_ORDER — цвета данных (NEED_DATA_PAPER, как столбики
// «Готово» и линии «Истории») и высоты из реальных оценок (ревью g2 r4: высоты лендинга рисовали высокие
// столбики человеку с оценками 2,2,2,2,2 — данные пользователя только реальные). Лендинг пропов не даёт.
import { NEED_ORDER } from '../../../../shared/src/needs/types';
import { isRated } from '../../../../shared/src/needs/ratingRecord';
import { NEED_DATA_PAPER } from './paper';

/** Нет ни одной оценки — все полоски одной высоты: рисунка дня из пустоты нет. */
export const CHECK_IN_EVEN_H = 90;
/** Неоценённая потребность в частично оценённом дне — короткий пенёк. */
export const CHECK_IN_STUB_H = 20;
/** Оценка 1–10 → высота 40–130 (лист: низ полосок y=204, верх листа y=44). */
export const checkInBarH = (v: number): number => 30 + 10 * Math.min(10, v);

export interface CheckInBars {
  inks: readonly string[];
  heights: number[];
}

/** Цвета и высоты полосок по оценкам дня. */
export function checkInBars(ratings: Readonly<Record<string, number>> = {}): CheckInBars {
  const any = NEED_ORDER.some((id) => isRated(ratings, id));
  const height = (id: string) =>
    !any ? CHECK_IN_EVEN_H : isRated(ratings, id) ? checkInBarH(ratings[id]) : CHECK_IN_STUB_H;
  return { inks: NEED_DATA_PAPER, heights: NEED_ORDER.map(height) };
}

// Модель карточки дня в меню (SidebarFoot): индекс — та же формула, что на плитке и в итоге трекера
// (shared/src/needs/dayIndex.ts), полоски — оценки дня в порядке NEED_ORDER для Strokes values.
// Бумага: день оценён — шалфей листа «Готово» трекера, нет — солома трекера (ENTITY_LOOK.tracker);
// литералы, а не импорт таблицы вида в главный чанк, — сверка в sidebarDay.test.ts.
import { dayIndex, fmtIndex } from '../../../../shared/src/needs/dayIndex';
import { NEED_COLOR_ORDER } from '../../../../shared/src/needs/needColors';
import { isRated } from '../../../../shared/src/needs/ratingRecord';

export const DAY_OPEN_HUE = 70;
export const DAY_DONE_HUE = 135;

export interface SidebarDay {
  /** «6,4» — день оценён целиком; null — ещё нет. */
  index: string | null;
  hue: typeof DAY_OPEN_HUE | typeof DAY_DONE_HUE;
  /** Оценка потребности 1–10 или null — не оценена (пустой тон полоски). */
  values: (number | null)[];
}

export function sidebarDay(needIds: readonly string[], ratings: Record<string, number>): SidebarDay {
  const idx = dayIndex(needIds, ratings);
  return {
    index: idx === null ? null : fmtIndex(idx),
    hue: idx === null ? DAY_OPEN_HUE : DAY_DONE_HUE,
    values: NEED_COLOR_ORDER.map(id => (isRated(ratings, id) ? ratings[id] : null)),
  };
}

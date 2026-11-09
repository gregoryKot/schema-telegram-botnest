// Карточка дня в меню (SidebarFoot): индекс и полоски — те же функции, что у главной (shared/src/needs/dayIndex.ts,
// dayStrokes.ts). Бумага: день оценён — шалфей исхода «Готово» (литералы paper/outcomeLook.ts, их сверка —
// outcomeLook.test.ts), нет — солома трекера литералом, не импорт таблицы вида в главный чанк (sidebarDay.test.ts).
import { dayIndex, fmtIndex } from '../../../../shared/src/needs/dayIndex';
import { dayStrokeValues } from '../../../../shared/src/needs/dayStrokes';
import { OUTCOME_LOOK_LIT } from '../paper/outcomeLook';

export const DAY_OPEN_HUE = 70;
export const DAY_DONE_HUE = OUTCOME_LOOK_LIT.done.hue;

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
    values: dayStrokeValues(ratings),
  };
}

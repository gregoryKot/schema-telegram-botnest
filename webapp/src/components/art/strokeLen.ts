// Оценка дня → длина полоски: одна шкала на все полоски, которые значат оценки дня, — знак `Strokes values`
// (главная, меню, лента дат) и сегодняшний лист сцены `SceneCheckIn values` (праздник серии, «Карточка недели»).
// Доля от полной — общая ratingShare (её же берут столбики «Готово», DayBars); пустое место (null — не оценена)
// — одна доля EMPTY_SHARE во всех местах, цвет его — правило `.pp-strokes-values` (styles/paper.css), а не своё.
import { ratingShare } from '../../../../shared/src/needs/ratingShare';

/** Раскладка пяти полосок в своём холсте: левый край первой, шаг, ширина, линия низа, длины от и до. */
export interface StrokeGeom { x: number; step: number; w: number; foot: number; min: number; max: number }

/** Пустое место — та же доля полной высоты везде: видно, что место есть, и его не спутать с низкой оценкой. */
export const EMPTY_SHARE = 56 / 68;
/** Знак Strokes (холст 120×100): от кружка 16 до 84, низ на 92. */
export const STROKES_GEOM: StrokeGeom = { x: 8, step: 22, w: 16, foot: 92, min: 16, max: 84 };
/** Сегодняшний лист SceneCheckIn (лист y 44–224): от кружка 20 до 130, низ на 204. */
export const CHECK_IN_GEOM: StrokeGeom = { x: 116, step: 31, w: 20, foot: 204, min: 20, max: 130 };
/** Холсты полосок по месту (ValueStrokes `at`). */
export const STROKE_GEOMS = { strokes: STROKES_GEOM, checkIn: CHECK_IN_GEOM } as const;

/** Длина полоски по оценке 0–10; null — пустое место. */
export function strokeLen(v: number | null, g: StrokeGeom): number {
  return g.min + Math.round((v == null ? EMPTY_SHARE : ratingShare(v)) * (g.max - g.min));
}

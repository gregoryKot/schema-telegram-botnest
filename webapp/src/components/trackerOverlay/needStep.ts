import { NEED_SCALE_MAX } from '../needScaleModel';

/** Новое значение оценки после нажатия «+»/«−». Ниже 1 и выше 10 не уходит; с нуля «+» даёт 1. */
export function stepNeedValue(value: number, dir: 1 | -1): number {
  if (value <= 0) return dir > 0 ? 1 : 0;
  return Math.min(NEED_SCALE_MAX, Math.max(1, value + dir));
}

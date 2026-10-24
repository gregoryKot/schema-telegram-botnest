export const NEED_SCALE_MAX = 10;

/** Заполнен ли сегмент n (1…10) при оценке value. Нет оценки — всё пусто. */
export function isSegmentFilled(n: number, value: number | undefined): boolean {
  return value !== undefined && n <= value;
}

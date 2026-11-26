/**
 * Доля полной высоты полоски по оценке 0–10 (выше 10 не растёт; 0 и меньше — 0): одна шкала на столбики
 * «Готово» (DayBars), полоски дня `Strokes values` и сегодняшний лист `SceneCheckIn values` (strokeLen).
 */
export function ratingShare(v: number): number {
  return v > 0 ? Math.min(10, v) / 10 : 0;
}

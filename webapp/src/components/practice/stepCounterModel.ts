// Счёт шагов быстрых практик — одна механика на полосу фаз дыхания и счётчики пошаговых листов
// (камешки заземления, буквы «Стопа»): какой отрезок пройден, какой сейчас, какой впереди; и
// раскладка камешков 5-4-3-2-1 — от большого к малому, каждый лежит на земле.

export type StepMark = 'done' | 'now' | 'next';

/** Состояние каждого из `total` шагов, когда идёт шаг `step` (с нуля); за концом — все пройдены. */
export function stepMarks(total: number, step: number): StepMark[] {
  return Array.from({ length: total }, (_, i) => (i < step ? 'done' : i === step ? 'now' : 'next'));
}

export interface PebbleSpot {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

/** Земля счётчика камешков (единицы холста) и зазор между камешками. */
export const PEBBLE_GROUND = 50;
const GAP = 12;
const LEFT = 8;

/**
 * Камешки в ряд от большого к малому: первый — rx 24, каждый следующий на шаг мельче (до 10),
 * все лежат на земле (cy = земля − ry). Ширина холста — правый край последнего плюс поле.
 */
export function pebbleRow(n: number): { spots: PebbleSpot[]; width: number } {
  const spots: PebbleSpot[] = [];
  let x = LEFT;
  for (let i = 0; i < n; i++) {
    const rx = n > 1 ? 24 - (14 * i) / (n - 1) : 24;
    const ry = rx * 0.62;
    spots.push({ cx: x + rx, cy: PEBBLE_GROUND - ry, rx, ry });
    x += 2 * rx + GAP;
  }
  return { spots, width: x - GAP + LEFT };
}

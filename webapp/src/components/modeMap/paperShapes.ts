// Контуры бумажных фигур холста, которых нет среди форм режимов (shared/src/modeMap/modeShapes.ts):
// триггер — лента (момент, который зацепил), поведение — ступени (что человек делает дальше).
// Те же формы у знаков палитры (PaletteMark). Путь строится в пикселях фигуры: вырез ленты и
// ступени не растягиваются вместе с текстом, поэтому отступы текста — постоянные.

/** Глубина выреза ленты с каждого конца, px. */
export const RIBBON_NOTCH = 12;
/** Высота одной ступени, px; ступеней две, площадок три. */
export const STEP_RISE = 8;

const n = (v: number) => Math.round(v * 100) / 100;

/** Лента с вырезами-«ласточками» по концам. */
export function ribbonPath(w: number, h: number): string {
  const k = Math.min(RIBBON_NOTCH, w / 6);
  return `M1,1 L${n(w - 1)},1 L${n(w - 1 - k)},${n(h / 2)} L${n(w - 1)},${n(h - 1)} L1,${n(h - 1)} L${n(1 + k)},${n(h / 2)} Z`;
}

/** Ступени вверх слева направо: три площадки по трети ширины. */
export function stepsPath(w: number, h: number): string {
  const r = Math.min(STEP_RISE, h / 6);
  const a = n(w / 3), b = n((2 * w) / 3);
  return `M1,${n(h - 1)} L1,${n(1 + 2 * r)} L${a},${n(1 + 2 * r)} L${a},${n(1 + r)} L${b},${n(1 + r)} L${b},1 L${n(w - 1)},1 L${n(w - 1)},${n(h - 1)} Z`;
}

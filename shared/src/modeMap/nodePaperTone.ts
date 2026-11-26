// Бумага узла — одна формула на две поверхности: холст графических карт
// (webapp/src/components/modeMap/nodePaper.ts) и схему случая концептуализации
// (shared/src/therapy/conceptGraph/diagram/diagramPaper.ts). Раньше числа жили
// в двух местах и разошлись (контур 0.72 0.07 против 0.7 0.075): карта,
// открытая со схемы случая, показывала тот же узел другим тоном.

/** «L C» бумаги узла: лицо, контур, тень-подложка и бледный контур узла без связей. */
export const NODE_PAPER_LC = {
  fill: '0.915 0.03',
  line: '0.72 0.07',
  shade: '0.85 0.045',
  faintLine: '0.82 0.045',
} as const;

/** Готовый цвет оттенка `hue` без var(): экспорт картинкой переменные не разрешает. */
export const paperTone = (lc: string, hue: number): string =>
  `oklch(${lc} ${hue})`;

/** Лицо фигуры. */
export const paperFill = (hue: number): string =>
  paperTone(NODE_PAPER_LC.fill, hue);

/** Контур фигуры; `faint` — режим или схема без связей: бледнее. */
export const paperEdge = (hue: number, faint = false): string =>
  paperTone(faint ? NODE_PAPER_LC.faintLine : NODE_PAPER_LC.line, hue);

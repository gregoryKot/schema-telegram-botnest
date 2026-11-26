// Таблица знаков бумаги для canvas шаринга (рисует signs.ts): та же геометрия, что у SVG-мотивов
// сайта (webapp/src/components/art/*: PaperArt, PaperArtSigns, NeedArt, AppSigns, GuideSigns*),
// примитивами, а не картинкой — canvas не рисует <svg> синхронно. Ключ — SignKey ENTITY_LOOK;
// цвет — имя бумаги PAPER (значение — PAPER_INK). Сверка «таблица = рисунок SignArt по ключу»
// (тег, геометрия, поворот, цвет) — webapp/src/share/signsCanvas.test.ts: правка мотива на
// сайте без правки здесь краснеет. Строка таблицы = один SVG-элемент, поэтому без переноса.
import type { SignKey } from '../../theme/signKeys';
import type { PaperName } from './ink';

/** Поворот вокруг точки, как SVG `rotate(deg cx cy)`. */
export type Rot = readonly [deg: number, cx: number, cy: number];
interface Paint {
  fill?: PaperName;
  alpha?: number;
  rot?: Rot;
}
interface Stroked {
  stroke?: PaperName;
  sw?: number;
}
export type SignPrim =
  | (Paint &
      Stroked & {
        t: 'rect';
        x: number;
        y: number;
        w: number;
        h: number;
        rx: number;
      })
  | (Paint & { t: 'circle'; cx: number; cy: number; r: number })
  | (Paint &
      Stroked & {
        t: 'ellipse';
        cx: number;
        cy: number;
        rx: number;
        ry: number;
      })
  | (Paint & Stroked & { t: 'path'; d: string; join?: 'round' });

export interface SignDrawing {
  view: readonly [w: number, h: number];
  prims: readonly SignPrim[];
}

/** Линия-контур (дуга, земля): только обводка. */
const line = (d: string, stroke: PaperName = 'sage', sw = 4): SignPrim => ({
  t: 'path',
  d,
  stroke,
  sw,
});
/** Полоска потребности (NeedArt Stroke): x — левый край, высота h, наклон вокруг низа. */
const stroke = (
  x: number,
  h: number,
  fill: PaperName,
  deg = 0,
  y = 60 - h,
): SignPrim => ({
  t: 'rect',
  x,
  y,
  w: 16,
  h,
  rx: 8,
  fill,
  rot: [deg, x + 8, 60],
});
const TILT = [-6, 3, -2, 5, -4];
const FIVE: PaperName[] = ['moss', 'sage', 'brown', 'clay', 'sage'];
const HEART_D =
  'M60 58 C 40 46, 20 36, 20 22 C 20 12, 30 6, 40 10 C 48 13, 56 20, 60 26 C 64 20, 72 13, 80 10 C 90 6, 100 12, 100 22 C 100 36, 80 46, 60 58 Z';
// prettier-ignore
const CAIRN = [
  { cx: 80, rx: 21, ry: 7.5, deg: -3, fill: 'brown' },
  { cx: 78, rx: 17, ry: 6.5, deg: 4, fill: 'clay' },
  { cx: 81, rx: 13.5, ry: 5.5, deg: -4, fill: 'amber' },
  { cx: 79, rx: 10.5, ry: 4.6, deg: 3, fill: 'slate' },
  { cx: 80.5, rx: 7.5, ry: 3.8, deg: -2, fill: 'moss' },
] as const;
// Тот же расчёт, что CAIRN_CY в AppSigns.tsx: каждый камешек лежит на предыдущем.
const CAIRN_CY = CAIRN.reduce<number[]>(
  (acc, s, i) => [
    ...acc,
    i === 0 ? 58 - s.ry : acc[i - 1] - CAIRN[i - 1].ry - s.ry,
  ],
  [],
);
const W64 = [120, 64] as const;

// prettier-ignore
export const CANVAS_SIGNS = {
  strokes: {
    view: [120, 100],
    prims: FIVE.map((fill, i): SignPrim => ({ t: 'rect', x: 8 + i * 22, y: 8, w: 16, h: 84, rx: 8, fill, rot: [TILT[i], 16 + i * 22, 50] })),
  },
  pebbles: {
    view: W64,
    prims: ([[24, 36, 'moss'], [60, 34, 'brown'], [96, 30, 'clay']] as const).map(([cx, cy, fill]): SignPrim => ({
      t: 'ellipse', cx, cy, rx: 20, ry: 13, fill, rot: [-18, cx, cy],
    })),
  },
  breath: {
    view: W64,
    prims: [line('M14 54 A46 46 0 0 1 106 54', 'sage', 12), line('M34 54 A26 26 0 0 1 86 54', 'moss', 12), { t: 'circle', cx: 60, cy: 54, r: 7, fill: 'clay' }],
  },
  sheets: {
    view: W64,
    prims: [
      { t: 'rect', x: 22, y: 10, w: 40, h: 50, rx: 6, fill: 'sage', rot: [-12, 42, 35] },
      { t: 'rect', x: 40, y: 6, w: 40, h: 52, rx: 6, fill: 'brown', rot: [-4, 60, 32] },
      { t: 'rect', x: 58, y: 8, w: 40, h: 52, rx: 6, fill: 'clay', rot: [6, 78, 34] },
    ],
  },
  layers: {
    view: W64,
    prims: [
      { t: 'rect', x: 10, y: 40, w: 100, h: 16, rx: 8, fill: 'sage' },
      { t: 'rect', x: 22, y: 24, w: 76, h: 16, rx: 8, fill: 'moss' },
      { t: 'rect', x: 36, y: 8, w: 48, h: 16, rx: 8, fill: 'clay' },
    ],
  },
  cluster: {
    view: W64,
    prims: [
      { t: 'circle', cx: 30, cy: 36, r: 22, fill: 'slate', alpha: 0.85 },
      { t: 'circle', cx: 66, cy: 26, r: 16, fill: 'brown' },
      { t: 'circle', cx: 94, cy: 40, r: 12, fill: 'clay' },
      { t: 'circle', cx: 70, cy: 50, r: 8, fill: 'sage' },
    ],
  },
  leaf: {
    view: W64,
    prims: [{ t: 'path', d: 'M26 58 C 26 24, 56 8, 100 8 C 100 44, 70 60, 26 58 Z', fill: 'moss' }, line('M30 56 C 48 44, 70 30, 96 12')],
  },
  check: {
    view: W64,
    prims: [{ t: 'rect', x: 14, y: 10, w: 92, h: 44, rx: 10, fill: 'sage' }, { t: 'path', d: 'M40 34 L 54 46 L 82 20', stroke: 'moss', sw: 11, join: 'round' }],
  },
  heart: { view: W64, prims: [{ t: 'path', d: HEART_D, fill: 'clay' }] },
  wheel: {
    view: W64,
    prims: [
      ...FIVE.map((fill, i): SignPrim => ({ t: 'rect', x: 52, y: 0, w: 16, h: 22, rx: 8, fill, rot: [i * 72, 60, 33] })),
      { t: 'circle', cx: 60, cy: 33, r: 9, fill: 'clay' },
    ],
  },
  talk: {
    view: W64,
    prims: [
      { t: 'ellipse', cx: 46, cy: 30, rx: 34, ry: 20, fill: 'sage' },
      { t: 'path', d: 'M26 46 L 20 58 L 40 48 Z', fill: 'sage' },
      { t: 'ellipse', cx: 82, cy: 36, rx: 28, ry: 17, fill: 'clay' },
      { t: 'path', d: 'M98 50 L 104 60 L 86 52 Z', fill: 'clay' },
    ],
  },
  child_care: {
    view: W64,
    prims: [line('M39.5 17.7 A25 25 0 1 0 80.5 17.7', 'sage', 13), { t: 'circle', cx: 60, cy: 35, r: 11, fill: 'clay' }],
  },
  scales: {
    view: W64,
    prims: [
      { t: 'path', d: 'M60 38 L 71 58 H 49 Z', fill: 'sage', stroke: 'sage', sw: 4, join: 'round' },
      { t: 'rect', x: 12, y: 32, w: 96, h: 7, rx: 3.5, fill: 'brown', rot: [-7, 60, 35] },
      { t: 'ellipse', cx: 28, cy: 23, rx: 15, ry: 9, fill: 'moss', rot: [-7, 60, 35] },
      { t: 'ellipse', cx: 92, cy: 25, rx: 11, ry: 7, fill: 'clay', rot: [-7, 60, 35] },
    ],
  },
  need_attachment: { view: W64, prims: [stroke(40, 50, 'sage', 14), stroke(64, 50, 'clay', -14)] },
  need_autonomy: { view: W64, prims: [line('M16 60 H104'), stroke(52, 54, 'moss')] },
  need_expression: { view: W64, prims: [stroke(24, 50, 'moss'), line('M46 20 C 58 8, 68 32, 80 20 S 102 8, 110 20', 'clay', 9)] },
  need_play: { view: W64, prims: [line('M22 58 C 30 10, 90 10, 98 58', 'amber', 16), { t: 'circle', cx: 60, cy: 14, r: 5, fill: 'clay' }] },
  need_limits: { view: W64, prims: [{ t: 'rect', x: 26, y: 4, w: 68, h: 56, rx: 14, stroke: 'moss', sw: 8 }, stroke(52, 36, 'clay', 0, 14)] },
  grounded: {
    view: W64,
    prims: [
      line('M14 60 H110'),
      { t: 'rect', x: 30, y: 8, w: 16, h: 50, rx: 8, fill: 'moss' },
      ...CAIRN.map((s, i): SignPrim => ({ t: 'ellipse', cx: s.cx, cy: CAIRN_CY[i], rx: s.rx, ry: s.ry, fill: s.fill, rot: [s.deg, s.cx, CAIRN_CY[i]] })),
    ],
  },
  haven: {
    view: W64,
    prims: [
      { t: 'path', d: 'M26 6 V46 Q26 58 38 58 H82 Q94 58 94 46 V6', stroke: 'moss', sw: 8, join: 'round' },
      { t: 'circle', cx: 47, cy: 44, r: 10, fill: 'clay' },
      { t: 'path', d: 'M64 54 C 60 40, 68 26, 84 22 C 86 38, 80 50, 64 54 Z', fill: 'moss' },
    ],
  },
  pause: { view: W64, prims: [line('M6 42 C 14 20, 30 18, 40 32 S 66 46, 90 32', 'clay', 11), line('M90 8 A 26 26 0 0 1 90 56', 'moss', 13)] },
  looming: {
    view: W64,
    prims: [line('M14 61 H106'), { t: 'circle', cx: 52, cy: 23, r: 21, fill: 'plum' }, { t: 'ellipse', cx: 70, cy: 53, rx: 14, ry: 6, fill: 'clay' }],
  },
  together: {
    view: W64,
    prims: [
      line('M10 58 H110'),
      { t: 'circle', cx: 40, cy: 35, r: 21, fill: 'moss' },
      { t: 'circle', cx: 72, cy: 46, r: 10, fill: 'clay' },
      { t: 'path', d: 'M94 56 C 88 40, 96 26, 112 22 C 114 38, 108 52, 94 56 Z', fill: 'moss' },
    ],
  },
} as const satisfies Partial<Record<SignKey, SignDrawing>>;

// Вариант мотива по счёту (не новый знак): значки достижений — серии `Strokes` всё плотнее, 10 и 50
// дней — `Sheets` стопкой; благодарность — `Pebbles filled`, легло n камешков, остальные — гнёзда.
// Одна геометрия на SVG (SignArt `count`) и canvas-карточки (signs.ts lookDrawing); сверка SVG =
// таблица — webapp/src/share/signsCanvas.test.ts.
import type { PaperName } from './ink';
import type { SignDrawing, SignPrim } from './signTable';

const STROKE_PAPER: readonly PaperName[] = ['moss', 'sage', 'brown', 'clay', 'sage'];
const STROKE_TILT = [-6, 3, -2, 5, -4];
const SHEET_PAPER: readonly PaperName[] = ['sage', 'brown', 'clay', 'moss'];

/** Больше пяти полосок — плотный ряд: уже и теснее, чтобы встали на тот же холст. */
function strokesRow(n: number): SignDrawing {
  const w = n > 5 ? 11 : 16;
  const step = n > 5 ? 15 : 22;
  const x0 = (120 - ((n - 1) * step + w)) / 2;
  const prims = Array.from({ length: n }, (_, i): SignPrim => {
    const x = x0 + i * step;
    return { t: 'rect', x, y: 8, w, h: 84, rx: w / 2, fill: STROKE_PAPER[i % 5], rot: [STROKE_TILT[i % 5], x + w / 2, 50] };
  });
  return { view: [120, 100], prims };
}

/** Листы веером: крайние — как у `Sheets` (-12° слева, 6° справа), между ними поровну. */
function sheetsFan(n: number): SignDrawing {
  const prims = Array.from({ length: n }, (_, i): SignPrim => {
    const t = i / (n - 1);
    const x = 22 + 36 * t;
    return { t: 'rect', x, y: 8, w: 40, h: 52, rx: 6, fill: SHEET_PAPER[i % 4], rot: [-12 + 18 * t, x + 20, 34] };
  });
  return { view: [120, 64], prims };
}

const PEBBLES = [[24, 36, 'moss'], [60, 34, 'brown'], [96, 30, 'clay']] as const;

/** Легло n камешков; гнездо — пустой тон с кромкой своего цвета (как [data-laid="no"] в paper.css). */
function pebblesLaid(n: number): SignDrawing {
  const prims = PEBBLES.map(([cx, cy, color], i): SignPrim => ({
    t: 'ellipse', cx, cy, rx: 20, ry: 13, rot: [-18, cx, cy],
    ...(i < n ? { fill: color } : { fill: 'hollow', stroke: color, sw: 4 }),
  }));
  return { view: [120, 64], prims };
}

const COUNTED = {
  strokes: { min: 2, max: 7, draw: strokesRow },
  sheets: { min: 2, max: 4, draw: sheetsFan },
  pebbles: { min: 0, max: 3, draw: pebblesLaid },
} as const;

/** Рисунок знака с числом фигур; знак без варианта по счёту или число вне диапазона — null (обычный знак). */
export function countedDrawing(sign: string, n: number | undefined): SignDrawing | null {
  if (n === undefined || !Object.hasOwn(COUNTED, sign)) return null;
  const v = COUNTED[sign as keyof typeof COUNTED];
  return Number.isInteger(n) && n >= v.min && n <= v.max ? v.draw(n) : null;
}

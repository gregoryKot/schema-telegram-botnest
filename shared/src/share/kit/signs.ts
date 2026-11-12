// Знаки бумаги на canvas шаринга: рисование таблицы signTable.ts (геометрия SVG-мотивов
// сайта, сверка — webapp/src/share/signsCanvas.test.ts) — поворот, бумага по имени, контур
// через Path2D. Ключ — SignKey ENTITY_LOOK; ключа нет в таблице — ничего не рисуется.
import { PAPER_INK } from './ink';
import { CANVAS_SIGNS, type SignPrim } from './signTable';

export {
  CANVAS_SIGNS,
  type SignPrim,
  type Rot,
  type SignDrawing,
} from './signTable';

export type CanvasSignKey = keyof typeof CANVAS_SIGNS;
export const CANVAS_SIGN_KEYS = Object.keys(CANVAS_SIGNS) as CanvasSignKey[];

/** Ключ, для которого есть canvas-рисунок; иначе null (без выдуманной картинки). */
export function canvasSign(key: string | undefined): CanvasSignKey | null {
  return key && Object.hasOwn(CANVAS_SIGNS, key)
    ? (key as CanvasSignKey)
    : null;
}

/** Высота знака шириной w по пропорции его холста. */
export function signHeight(key: CanvasSignKey, w: number): number {
  const [vw, vh] = CANVAS_SIGNS[key].view;
  return (w * vh) / vw;
}

function paintPrim(ctx: CanvasRenderingContext2D, p: SignPrim) {
  ctx.save();
  ctx.globalAlpha = p.alpha ?? 1;
  if (p.rot && p.rot[0] !== 0) {
    ctx.translate(p.rot[1], p.rot[2]);
    ctx.rotate((p.rot[0] * Math.PI) / 180);
    ctx.translate(-p.rot[1], -p.rot[2]);
  }
  let path: Path2D | null = null;
  ctx.beginPath();
  if (p.t === 'rect') ctx.roundRect(p.x, p.y, p.w, p.h, p.rx);
  else if (p.t === 'circle') ctx.arc(p.cx, p.cy, p.r, 0, Math.PI * 2);
  else if (p.t === 'ellipse')
    ctx.ellipse(p.cx, p.cy, p.rx, p.ry, 0, 0, Math.PI * 2);
  else if (typeof Path2D !== 'undefined') path = new Path2D(p.d);
  if (p.fill) {
    ctx.fillStyle = PAPER_INK[p.fill];
    if (path) ctx.fill(path);
    else ctx.fill();
  }
  if ((p.t === 'path' || p.t === 'rect') && p.stroke) {
    ctx.strokeStyle = PAPER_INK[p.stroke];
    ctx.lineWidth = p.sw ?? 1;
    ctx.lineCap = 'round';
    ctx.lineJoin = p.t === 'path' && p.join ? p.join : 'miter';
    if (path) ctx.stroke(path);
    else ctx.stroke();
  }
  ctx.restore();
}

/** Знак по ключу: левый верхний угол (x, y), ширина w, высота — по пропорции холста знака. */
export function drawSign(
  ctx: CanvasRenderingContext2D,
  key: CanvasSignKey,
  x: number,
  y: number,
  w: number,
) {
  const s = CANVAS_SIGNS[key];
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(w / s.view[0], w / s.view[0]);
  for (const p of s.prims) paintPrim(ctx, p);
  ctx.restore();
}

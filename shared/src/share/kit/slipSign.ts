// Знак шага на бумажке своей сущности — строка карточки-ленты и карточки итогов «Моего пути»: тот же
// вид, что строка ленты и плитка счётчика в приложении (journeyLook, вариант по счёту — lookDrawing).
import { hueGap, paperSlip, type Card } from './frame';
import { sunkHex } from './paperFrame';
import { drawDrawing, drawingHeight, lookDrawing } from './signs';

export interface SlipBox {
  w: number;
  h: number;
  /** Ширина знака и потолок его высоты внутри бумажки. */
  signW: number;
  signBox: number;
}

/** Бумажка с вписанным знаком; знака нет — тихая бумажка листа. Бумажка оттенка самого листа —
 *  тоном глубже своей бумаги (светлая --surface выпадала белой на небе «Моего пути»). */
export function slipSign(
  c: Card,
  look: { hue: number; sign: string; n?: number } | null,
  x: number,
  y: number,
  b: SlipBox,
) {
  const d = lookDrawing(look);
  if (!look || !d) {
    paperSlip(c, x, y, b.w, b.h, c.hue, { r: 10, fill: c.sunk, shadow: false });
    return;
  }
  paperSlip(
    c,
    x,
    y,
    b.w,
    b.h,
    look.hue,
    hueGap(look.hue, c.hue) < 25
      ? { r: 10, fill: sunkHex(look.hue) }
      : { r: 10 },
  );
  const h0 = drawingHeight(d, b.signW);
  const w = h0 > b.signBox ? (b.signW * b.signBox) / h0 : b.signW;
  const h = drawingHeight(d, w);
  drawDrawing(c.ctx, d, x + (b.w - w) / 2, y + (b.h - h) / 2, w);
}

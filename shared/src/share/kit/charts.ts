// Графика карточек на бумаге: плитки-показатели и полоски. Без градиентов и свечений —
// сплошная бумага, паз тоном глубже листа (c.sunk), заливка — цветом данных.
import { CARD_PAD, cardFont, serifFont } from './theme';
import { panel, tracking, type Card } from './frame';
import { INK, inkOf } from './ink';

export interface StatTile {
  label: string;
  value: string;
  hint?: string;
  color?: string;
}

/** Высота плитки-показателя. */
export const STAT_TILE_H = 70;

/**
 * Плитки-показатели в ряд на светлых плашках: подпись, крупное число Literata, хвост-единица.
 * Возвращает Y под плитками.
 */
export function drawStatTiles(c: Card, tiles: StatTile[], y: number): number {
  const { ctx } = c;
  const gap = 10;
  const w = (c.W - CARD_PAD * 2 - gap * (tiles.length - 1)) / tiles.length;

  tiles.forEach((t, i) => {
    const x = CARD_PAD + i * (w + gap);
    panel(c, x, y, w, STAT_TILE_H, 14);
    ctx.textAlign = 'left';
    ctx.font = cardFont(10, 'bold');
    ctx.fillStyle = INK.sub;
    tracking(ctx, 0.6);
    ctx.fillText(t.label.toUpperCase(), x + 14, y + 23);
    tracking(ctx, 0);
    ctx.font = serifFont(26);
    ctx.fillStyle = t.color ? inkOf(t.color) : INK.text;
    ctx.fillText(t.value, x + 14, y + 54);
    if (t.hint) {
      const vw = ctx.measureText(t.value).width;
      ctx.font = cardFont(12);
      ctx.fillStyle = INK.sub;
      ctx.fillText(t.hint, x + 14 + vw + 6, y + 53);
    }
  });
  return y + STAT_TILE_H;
}

/** Полоска доли pct (0..1): паз тоном глубже листа, заливка сплошным цветом данных. */
export function progressBar(
  c: Card,
  x: number,
  y: number,
  w: number,
  pct: number,
  color: string,
  h = 8,
) {
  const { ctx } = c;
  ctx.fillStyle = c.sunk;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h / 2);
  ctx.fill();
  const filled = Math.max(0, Math.min(1, pct));
  if (filled <= 0) return;
  ctx.fillStyle = inkOf(color);
  ctx.beginPath();
  ctx.roundRect(x, y, Math.max(h, w * filled), h, h / 2);
  ctx.fill();
}

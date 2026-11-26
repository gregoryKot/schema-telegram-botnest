// Пять потребностей на бумаге карточки: столбики дня (DayBars экрана «Готово» трекера —
// паз во всю высоту, в нём столбик по оценке цветом данных потребности) и строки «знак-метка →
// название → число». Цвет данных и цвет числа — палитра данных (ink.ts, решение 7).
import { ratingShare } from '../../needs/ratingShare';
import { CARD_PAD, cardFont, serifFont } from './theme';
import { sign, type Card } from './frame';
import { INK, inkAlpha, needDataInk, needTextInk } from './ink';

export interface NeedValue {
  /** id потребности (attachment, autonomy…); знак и цвет — по нему. */
  id: string;
  /** Оценка 0..10; null — не отмечена (пустой паз, «—»). */
  value: number | null;
}

/** Ширина знака потребности под столбиком. */
const BAR_SIGN_W = 40;
const SLOT_MAX_W = 30;

/** Высота блока столбиков с подписями-знаками под ними. */
export const dayBarsHeight = (barH: number) =>
  barH + 10 + (BAR_SIGN_W * 64) / 120;

/**
 * Столбики дня в полосе [x, x + w], паз высотой barH от y. Под столбиком — знак потребности
 * (вместо эмодзи). Пустая оценка — короткая метка на дне паза. Возвращает Y под блоком.
 */
export function drawDayBars(
  c: Card,
  needs: readonly NeedValue[],
  x: number,
  y: number,
  w: number,
  barH: number,
): number {
  const { ctx } = c;
  const col = w / Math.max(1, needs.length);
  const slotW = Math.min(SLOT_MAX_W, col - 12);
  needs.forEach((n, i) => {
    const cx = x + col * i + col / 2;
    const sx = cx - slotW / 2;
    ctx.fillStyle = inkAlpha(0.07);
    ctx.beginPath();
    ctx.roundRect(sx, y, slotW, barH, slotW / 2);
    ctx.fill();
    const color = needDataInk(n.id);
    if (n.value && n.value > 0 && color) {
      const h = Math.max(slotW, ratingShare(n.value) * barH);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(sx, y + barH - h, slotW, h, slotW / 2);
      ctx.fill();
    } else {
      ctx.fillStyle = inkAlpha(0.22);
      ctx.beginPath();
      ctx.roundRect(sx + 5, y + barH - 10, slotW - 10, 6, 3);
      ctx.fill();
    }
    sign(c, `need_${n.id}`, cx - BAR_SIGN_W / 2, y + barH + 10, BAR_SIGN_W);
  });
  return y + dayBarsHeight(barH);
}

export const NEED_ROW_H = 30;

/**
 * Строка потребности: метка-полоска цветом данных, название, число справа читаемым тоном
 * того же оттенка. Без оценки — бледная метка и «—» подписью. y — верх строки.
 */
export function drawNeedRow(
  c: Card,
  n: NeedValue & { label: string; valueText: string },
  y: number,
) {
  const { ctx } = c;
  const mid = y + NEED_ROW_H / 2;
  const rated = n.value !== null;
  ctx.fillStyle = (rated && needDataInk(n.id)) || inkAlpha(0.2);
  ctx.beginPath();
  ctx.roundRect(CARD_PAD, mid - 8, 6, 16, 3);
  ctx.fill();
  ctx.textAlign = 'left';
  ctx.font = cardFont(14);
  ctx.fillStyle = rated ? INK.text : INK.sub;
  ctx.fillText(n.label, CARD_PAD + 16, mid + 5);
  ctx.textAlign = 'right';
  ctx.font = serifFont(19);
  ctx.fillStyle = rated ? needTextInk(n.id) : INK.sub;
  ctx.fillText(n.valueText, c.W - CARD_PAD, mid + 6);
  ctx.textAlign = 'left';
}

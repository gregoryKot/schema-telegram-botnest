// Карточка-приглашение (пара / клиент терапевта): крупный код + подпись.
// Приватных данных нет — только код приглашения.
import {
  CARD_W,
  CARD_PAD,
  FOOTER_H,
  beginCard,
  accentBar,
  footer,
  drawWrapped,
  measureWrap,
  cardFont,
} from '../cardKit';

export interface InviteCardData {
  /** «Приглашение в пару» / «Приглашение от терапевта» */
  title: string;
  /** Код, который вводит второй человек */
  code: string;
  /** Подпись под кодом — что сделать (1-2 строки) */
  hint: string;
}

export function drawInviteCard(canvas: HTMLCanvasElement, d: InviteCardData) {
  const maxW = CARD_W - CARD_PAD * 2;
  const hintLines = Math.min(measureWrap(canvas, d.hint, maxW, 13).length, 3);
  const H = 96 + 74 + 30 + hintLines * 20 + 18 + FOOTER_H;
  const c = beginCard(canvas, H);
  const { ctx, W, th } = c;
  const cx = W / 2;

  accentBar(c);

  ctx.font = cardFont(15, 'bold');
  ctx.fillStyle = th.fg(0.9);
  ctx.textAlign = 'center';
  ctx.fillText(d.title, cx, 62);

  // Код — крупно, в рамке-плашке
  const codeY = 96;
  ctx.font = cardFont(34, 'bold');
  const codeW = ctx.measureText(d.code).width;
  const boxW = Math.min(maxW, codeW + 48);
  ctx.fillStyle = th.fg(0.06);
  ctx.beginPath();
  ctx.roundRect(cx - boxW / 2, codeY, boxW, 58, 14);
  ctx.fill();
  ctx.fillStyle = c.th.accent;
  ctx.fillText(d.code, cx, codeY + 40);

  drawWrapped(c, d.hint, cx, codeY + 88, maxW, {
    size: 13,
    color: th.fg(0.55),
    lineH: 20,
    maxLines: 3,
    align: 'center',
  });

  footer(c, 'Приглашение');
}

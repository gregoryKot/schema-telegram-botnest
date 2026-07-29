// Карточка-приглашение (пара / клиент терапевта): крупный код + подпись.
// Приватных данных нет — только код приглашения.
import {
  CARD_W,
  CARD_PAD,
  FOOTER_H,
  beginCard,
  footer,
  drawWrapped,
  measureWrap,
  clampLines,
  cardFont,
  tracking,
} from '../cardKit';

export interface InviteCardData {
  /** «Приглашение в пару» / «Приглашение от терапевта» */
  title: string;
  /** Код, который вводит второй человек */
  code: string;
  /** Подпись под кодом — что сделать (1-2 строки) */
  hint: string;
}

const EYEBROW_Y = 44;
const TITLE_Y = 78;
const CODE_TOP = 100;
const CODE_H = 76;
const HINT_LINE_H = 20;
const HINT_GAP = 30;
const HINT_MAX_LINES = 3;

export function drawInviteCard(canvas: HTMLCanvasElement, d: InviteCardData) {
  const maxW = CARD_W - CARD_PAD * 2;
  const hintLines = clampLines(
    measureWrap(canvas, d.hint, maxW, 13),
    HINT_MAX_LINES,
  );
  const H =
    CODE_TOP +
    CODE_H +
    HINT_GAP +
    hintLines.length * HINT_LINE_H +
    20 +
    FOOTER_H;

  const c = beginCard(canvas, H, {
    accent: 'var(--accent)',
    accent2: 'var(--accent-blue)',
  });
  const { ctx, th, W } = c;
  const cx = W / 2;

  ctx.font = cardFont(10, 'bold');
  ctx.fillStyle = c.accent;
  ctx.textAlign = 'center';
  tracking(ctx, 1);
  ctx.fillText('ПРИГЛАШЕНИЕ', cx, EYEBROW_Y);
  tracking(ctx, 0);

  ctx.font = cardFont(20, 'bold');
  ctx.fillStyle = th.fg(0.95);
  ctx.fillText(d.title, cx, TITLE_Y);

  // Код — крупно, в плашке с пунктирной рамкой.
  ctx.font = cardFont(34, 'bold');
  const codeW = ctx.measureText(d.code).width;
  const boxW = Math.min(maxW, codeW + 56);
  const boxX = cx - boxW / 2;

  ctx.fillStyle = th.fg(0.05);
  ctx.beginPath();
  ctx.roundRect(boxX, CODE_TOP, boxW, CODE_H, 16);
  ctx.fill();

  ctx.strokeStyle = c.accent;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 5]);
  ctx.beginPath();
  ctx.roundRect(boxX, CODE_TOP, boxW, CODE_H, 16);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = c.accent;
  tracking(ctx, 2);
  ctx.fillText(d.code, cx, CODE_TOP + CODE_H / 2 + 12);
  tracking(ctx, 0);

  drawWrapped(c, d.hint, cx, CODE_TOP + CODE_H + HINT_GAP, maxW, {
    size: 13,
    color: th.fg(0.55),
    lineH: HINT_LINE_H,
    maxLines: HINT_MAX_LINES,
    align: 'center',
  });

  ctx.textAlign = 'left';
  footer(c, 'Приглашение');
}

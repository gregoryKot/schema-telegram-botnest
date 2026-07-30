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
  withAlpha,
  type Card,
} from '../cardKit';

export interface InviteCardData {
  /** «Приглашение в пару» / «Приглашение от терапевта» */
  title: string;
  /** Код, который вводит второй человек. Нет кода — рисуются эмодзи. */
  code?: string;
  /**
   * Визуал вместо кода: одно эмодзи — медальон, несколько — ряд плиток.
   * Ссылку-приглашение на картинку не выносим: по ней нельзя ткнуть, она
   * уходит текстом рядом с картинкой.
   */
  emojis?: string[];
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

/**
 * Визуал приглашения без кода: одно эмодзи — медальон, несколько — ряд
 * тонированных плиток (пять потребностей говорят сами за себя).
 */
function drawInviteEmojis(c: Card, emojis: string[], top: number) {
  const { ctx, th, W } = c;
  const cx = W / 2;
  const midY = top + CODE_H / 2;
  ctx.textAlign = 'center';

  if (emojis.length <= 1) {
    const r = 40;
    const glow = ctx.createRadialGradient(cx, midY, 0, cx, midY, r);
    glow.addColorStop(0, withAlpha(c.accent, 0.28));
    glow.addColorStop(1, withAlpha(c.accent, 0.04));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, midY, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = withAlpha(c.accent, 0.35);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.font = '38px serif';
    ctx.fillStyle = th.fg(0.95);
    ctx.fillText(emojis[0] ?? '🤝', cx, midY + 14);
    return;
  }

  const TILE = 52;
  const GAP = 8;
  const rowW = emojis.length * TILE + (emojis.length - 1) * GAP;
  let x = cx - rowW / 2;
  for (const emoji of emojis) {
    ctx.fillStyle = withAlpha(c.accent, th.isLight ? 0.12 : 0.16);
    ctx.beginPath();
    ctx.roundRect(x, midY - TILE / 2, TILE, TILE, 15);
    ctx.fill();
    ctx.font = '25px serif';
    ctx.fillStyle = th.fg(0.95);
    ctx.fillText(emoji, x + TILE / 2, midY + 9);
    x += TILE + GAP;
  }
}

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

  if (!d.code) {
    drawInviteEmojis(c, d.emojis ?? [], CODE_TOP);
    drawWrapped(c, d.hint, cx, CODE_TOP + CODE_H + HINT_GAP, maxW, {
      size: 13,
      color: th.fg(0.55),
      lineH: HINT_LINE_H,
      maxLines: HINT_MAX_LINES,
      align: 'center',
    });
    ctx.textAlign = 'left';
    footer(c, 'Приглашение');
    return;
  }

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

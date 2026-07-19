// Карточка фразы Здорового взрослого: крупная цитата, минимум остального.
import {
  CARD_W,
  CARD_PAD,
  FOOTER_H,
  beginCard,
  accentBar,
  footer,
  measureWrap,
  clampLines,
  cardFont,
} from '../cardKit';

export function drawPhraseCard(canvas: HTMLCanvasElement, phrase: string) {
  const maxW = CARD_W - CARD_PAD * 2;
  const text = `«${phrase}»`;
  const lines = clampLines(measureWrap(canvas, text, maxW, 19, 'bold'), 7);
  const LINE_H = 30;
  const H = 92 + lines.length * LINE_H + 34 + FOOTER_H;
  const c = beginCard(canvas, H);
  const { ctx, th } = c;

  accentBar(c, '#06d6a0', '#4fa3f7');

  ctx.font = cardFont(11, 'bold');
  ctx.fillStyle = th.fg(0.4);
  ctx.textAlign = 'left';
  ctx.fillText('ФРАЗА ЗДОРОВОГО ВЗРОСЛОГО', CARD_PAD, 58);

  let y = 96;
  for (const line of lines) {
    ctx.font = cardFont(19, 'bold');
    ctx.fillStyle = th.fg(0.95);
    ctx.fillText(line, CARD_PAD, y);
    y += LINE_H;
  }

  footer(c, 'Поддержка себе');
}

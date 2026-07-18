// Карточка достижения: крупное эмодзи, титул, описание — по центру.
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

export interface AchievementMeta {
  emoji: string;
  title: string;
  desc: string;
}

export function drawAchievementCard(
  canvas: HTMLCanvasElement,
  m: AchievementMeta,
) {
  const maxW = CARD_W - CARD_PAD * 2;
  const descLines = Math.min(measureWrap(canvas, m.desc, maxW, 13).length, 3);
  // 24 бар + 76 эмодзи + 44 титул + строки описания + воздух + футер
  const H = 150 + 40 + descLines * 20 + 16 + FOOTER_H;
  const c = beginCard(canvas, H);
  const { ctx, W, th } = c;
  const cx = W / 2;

  accentBar(c, '#facc15', '#ff9a3c');

  ctx.font = '56px serif';
  ctx.textAlign = 'center';
  ctx.fillText(m.emoji, cx, 108);

  ctx.font = cardFont(22, 'bold');
  ctx.fillStyle = th.fg(0.95);
  ctx.fillText(m.title, cx, 152);

  drawWrapped(c, m.desc, cx, 180, maxW, {
    size: 13,
    color: th.fg(0.55),
    lineH: 20,
    maxLines: 3,
    align: 'center',
  });

  footer(c, 'Достижение');
}

// Карточка серии дней (стрик) — для Celebration обоих фронтендов.
import {
  drawEmoji,
  CARD_W,
  CARD_PAD,
  FOOTER_H,
  beginCard,
  panel,
  footer,
  drawWrapped,
  measureWrap,
  cardFont,
  withAlpha,
} from '../cardKit';
import { getMilestoneText, pluralDays } from '../../utils/celebrationText';

const MILESTONES = [3, 7, 14, 21, 30, 60, 100];
const MED_R = 44;
// Отступы композиции сверху вниз: медальон → число → подпись → плашка вехи
const TOP_PAD = 40;
const GAP_TO_NUMBER = 56;
const GAP_TO_CAPTION = 26;
const GAP_TO_PANEL = 20;
const GAP_TO_FOOTER = 16;

export function drawStreakCard(canvas: HTMLCanvasElement, streak: number) {
  const maxW = CARD_W - CARD_PAD * 2;
  const noteMaxW = maxW - 32;
  const note = getMilestoneText(streak);
  const noteLines = Math.min(measureWrap(canvas, note, noteMaxW, 13).length, 3);
  const panelH = 32 + noteLines * 18;

  const medallionBottom = TOP_PAD + MED_R * 2;
  const numberY = medallionBottom + GAP_TO_NUMBER;
  const captionY = numberY + GAP_TO_CAPTION;
  const panelY = captionY + GAP_TO_PANEL;
  const H = panelY + panelH + GAP_TO_FOOTER + FOOTER_H;

  const c = beginCard(canvas, H, {
    accent: 'var(--accent-orange)',
    accent2: 'var(--accent-red)',
  });
  const { ctx, th } = c;
  const cx = c.W / 2;
  const cy = TOP_PAD + MED_R;

  // Медальон: мягкое радиальное свечение + тонкое кольцо
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, MED_R);
  glow.addColorStop(0, withAlpha(c.accent, 0.3));
  glow.addColorStop(1, withAlpha(c.accent, 0.04));
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, MED_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = withAlpha(c.accent, 0.4);
  ctx.lineWidth = 1.5;
  ctx.stroke();

  drawEmoji(c, MILESTONES.includes(streak) ? '🏆' : '🔥', cx, cy + 16, 44, {
    align: 'center',
  });

  ctx.font = cardFont(52, 'bold');
  const numberText = String(streak);
  const numberW = ctx.measureText(numberText).width;
  const numGrad = ctx.createLinearGradient(
    cx - numberW / 2,
    0,
    cx + numberW / 2,
    0,
  );
  numGrad.addColorStop(0, c.accent);
  numGrad.addColorStop(1, c.accent2);
  ctx.fillStyle = numGrad;
  ctx.fillText(numberText, cx, numberY);

  ctx.font = cardFont(14);
  ctx.fillStyle = th.fg(0.55);
  ctx.fillText(`${pluralDays(streak)} подряд`, cx, captionY);

  panel(c, CARD_PAD, panelY, maxW, panelH);
  drawWrapped(c, note, cx, panelY + 16 + 13, noteMaxW, {
    size: 13,
    color: th.fg(0.6),
    lineH: 18,
    maxLines: 3,
    align: 'center',
  });

  footer(c, 'Серия дней');
}

// Карточка серии дней (стрик) — для Celebration обоих фронтендов.
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
import { getMilestoneText, pluralDays } from '../../utils/celebrationText';

const MILESTONES = [3, 7, 14, 21, 30, 60, 100];

export function drawStreakCard(canvas: HTMLCanvasElement, streak: number) {
  const maxW = CARD_W - CARD_PAD * 2;
  const note = getMilestoneText(streak);
  const noteLines = Math.min(measureWrap(canvas, note, maxW, 13).length, 3);
  const H = 150 + 62 + noteLines * 20 + 16 + FOOTER_H;
  const c = beginCard(canvas, H);
  const { ctx, W, th } = c;
  const cx = W / 2;

  accentBar(c, '#ff9a3c', '#ff6b9d');

  ctx.font = '52px serif';
  ctx.textAlign = 'center';
  ctx.fillText(MILESTONES.includes(streak) ? '🏆' : '🔥', cx, 104);

  ctx.font = cardFont(46, 'bold');
  ctx.fillStyle = th.fg(0.95);
  ctx.fillText(String(streak), cx, 158);

  ctx.font = cardFont(14);
  ctx.fillStyle = th.fg(0.55);
  ctx.fillText(`${pluralDays(streak)} подряд`, cx, 182);

  drawWrapped(c, note, cx, 212, maxW, {
    size: 13,
    color: th.fg(0.45),
    lineH: 20,
    maxLines: 3,
    align: 'center',
  });

  footer(c, 'Серия дней');
}

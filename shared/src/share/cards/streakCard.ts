// Карточка серии дней (стрик) — для Celebration: лист соломы трекера, знак Strokes
// крупно (полоски дней), число Literata и подпись; веха — светлой плашкой.
import {
  CARD_LOOK,
  CARD_W,
  CARD_PAD,
  FOOTER_H,
  INK,
  beginCard,
  panel,
  footer,
  drawWrapped,
  measureWrap,
  cardFont,
  serifFont,
  sign,
} from '../cardKit';
import { getMilestoneText, pluralDays } from '../../utils/celebrationText';

export const MILESTONES = [3, 7, 14, 21, 30, 60, 100];
/** Половина ширины знака серии (знак — 2.4 × MED_R в ширину). */
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

  const c = beginCard(canvas, H, { hue: CARD_LOOK.tracker.hue });
  const { ctx } = c;
  const cx = c.W / 2;

  sign(c, CARD_LOOK.tracker.sign, cx - MED_R * 1.2, TOP_PAD - 6, MED_R * 2.4);

  ctx.font = serifFont(58);
  ctx.fillStyle = INK.text;
  ctx.textAlign = 'center';
  ctx.fillText(String(streak), cx, numberY);

  ctx.font = cardFont(14);
  ctx.fillStyle = INK.sub;
  ctx.fillText(`${pluralDays(streak)} подряд`, cx, captionY);

  panel(c, CARD_PAD, panelY, maxW, panelH);
  drawWrapped(c, note, cx, panelY + 16 + 13, noteMaxW, {
    size: 13,
    color: INK.text,
    lineH: 18,
    maxLines: 3,
    align: 'center',
  });

  footer(c, 'Серия дней');
}

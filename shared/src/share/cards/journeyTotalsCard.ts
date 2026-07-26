// Карточка итогов «Моего пути»: «дневник 5 раз, трекер 7 раз…» — общий
// счётчик крупно + занятия по убыванию. Дополняет карточку-ленту (journeyCard,
// последние шаги по времени). Строки — journeyStatRows (чистая, с тестами).
import {
  CARD_PAD,
  FOOTER_H,
  beginCard,
  accentBar,
  header,
  divider,
  footer,
  cardFont,
} from '../cardKit';
import type { JourneyStatRow } from '../../journey/journeyStats';
import { pluralEntries } from '../shareTexts';

export const JOURNEY_TOTALS_MAX_ROWS = 8;

/** Верхние строки + «и ещё N занятий» хвостом. Чистая (для тестов). */
export function totalsCardRows(stats: JourneyStatRow[]): {
  shown: JourneyStatRow[];
  restCount: number;
} {
  return {
    shown: stats.slice(0, JOURNEY_TOTALS_MAX_ROWS),
    restCount: Math.max(0, stats.length - JOURNEY_TOTALS_MAX_ROWS),
  };
}

export function drawJourneyTotalsCard(
  canvas: HTMLCanvasElement,
  stats: JourneyStatRow[],
  total: number,
) {
  const { shown, restCount } = totalsCardRows(stats);
  const ROW_H = 38;
  const LIST_H = shown.length * ROW_H + (restCount > 0 ? 26 : 0);
  const H = 112 + 74 + LIST_H + 14 + FOOTER_H;
  const c = beginCard(canvas, H);
  const { ctx, W, th } = c;

  accentBar(c, '#a78bfa', '#34d399');
  const contentY = header(c, 'Мой путь', 'итоги заботы о себе');

  // Общий итог крупно
  const totalY = contentY + 24;
  ctx.font = cardFont(30, 'bold');
  ctx.fillStyle = th.fg(0.95);
  ctx.textAlign = 'left';
  ctx.fillText(String(total), CARD_PAD, totalY + 6);
  const totalW = ctx.measureText(String(total)).width;
  ctx.font = cardFont(13);
  ctx.fillStyle = th.fg(0.5);
  ctx.fillText(
    `${pluralEntries(total)} всего`,
    CARD_PAD + totalW + 10,
    totalY + 6,
  );

  const listTop = totalY + 26;
  divider(c, listTop);

  shown.forEach((row, i) => {
    const y = listTop + 16 + i * ROW_H + ROW_H / 2;
    ctx.font = '16px serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = th.fg(0.95);
    ctx.fillText(row.emoji, CARD_PAD, y + 5);
    ctx.font = cardFont(14);
    ctx.fillStyle = th.fg(0.72);
    ctx.fillText(row.label, CARD_PAD + 30, y + 4);
    ctx.font = cardFont(16, 'bold');
    ctx.fillStyle = th.fg(0.95);
    ctx.textAlign = 'right';
    ctx.fillText(String(row.count), W - CARD_PAD, y + 4);
    ctx.textAlign = 'left';
  });

  if (restCount > 0) {
    ctx.font = cardFont(11);
    ctx.fillStyle = th.fg(0.35);
    ctx.fillText(
      `…и ещё ${restCount} ${restCount === 1 ? 'занятие' : restCount < 5 ? 'занятия' : 'занятий'}`,
      CARD_PAD,
      listTop + 16 + shown.length * ROW_H + 8,
    );
  }

  footer(c, 'Мой путь');
}

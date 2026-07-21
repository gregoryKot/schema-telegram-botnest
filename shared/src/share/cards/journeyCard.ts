// Карточка «Мой путь»: сколько всего шагов заботы о себе + топ занятий
// (эмодзи · подпись · счётчик). Данные готовит journeyStatRows (чистая,
// тестируется без canvas) — сюда приходят уже отфильтрованные строки.
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
import type { JourneyStatRow } from '../../journey/journeyMeta';

// Больше строк карточка не вмещает — берём топ по счётчику.
export const JOURNEY_CARD_MAX_ROWS = 6;

export function drawJourneyCard(
  canvas: HTMLCanvasElement,
  rows: JourneyStatRow[],
  total: number,
) {
  const shown = rows.slice(0, JOURNEY_CARD_MAX_ROWS);
  const ROW_H = 40;
  const LIST_H = shown.length * ROW_H;
  const H = 120 + 78 + LIST_H + 24 + FOOTER_H - 20;
  const c = beginCard(canvas, H);
  const { ctx, W, th } = c;

  accentBar(c, '#34d399', '#4fa3f7');
  header(c, 'Мой путь', 'забота о себе в цифрах');

  // Главная цифра — всего шагов
  const totalY = 132;
  ctx.font = cardFont(11);
  ctx.fillStyle = th.fg(0.35);
  ctx.textAlign = 'left';
  ctx.fillText('Всего шагов', CARD_PAD, totalY);
  ctx.font = cardFont(30, 'bold');
  ctx.fillStyle = th.fg(0.95);
  ctx.fillText(String(total), CARD_PAD, totalY + 34);

  const listTop = totalY + 52;
  divider(c, listTop);

  shown.forEach((row, i) => {
    const y = listTop + 18 + i * ROW_H + ROW_H / 2;
    ctx.font = '18px serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = th.fg(0.95);
    ctx.fillText(row.emoji, CARD_PAD, y);
    ctx.font = cardFont(14);
    ctx.fillStyle = th.fg(0.72);
    ctx.fillText(row.label, CARD_PAD + 34, y);
    ctx.font = cardFont(16, 'bold');
    ctx.fillStyle = th.fg(0.95);
    ctx.textAlign = 'right';
    ctx.fillText(String(row.count), W - CARD_PAD, y);
    ctx.textAlign = 'left';
  });

  footer(c, 'Мой путь');
}

// Карточка «Мой путь» — лента последних шагов ПО ВРЕМЕНИ: дата слева,
// цветная точка группы, эмодзи и название занятия. Итог («N шагов») — в
// подзаголовке. Строки готовит buildJourneyCardRows (чистая, тестируется
// без canvas).
import {
  CARD_PAD,
  FOOTER_H,
  beginCard,
  accentBar,
  header,
  footer,
  cardFont,
} from '../cardKit';
import type { JourneyCardRow } from '../../journey/journeyMeta';
import { pluralEntries } from '../shareTexts';

// Больше строк карточка не вмещает — buildJourneyCardRows режет по нему.
export const JOURNEY_CARD_MAX_ROWS = 8;

export function drawJourneyCard(
  canvas: HTMLCanvasElement,
  rows: JourneyCardRow[],
  total: number,
) {
  const ROW_H = 42;
  const LIST_H = rows.length * ROW_H;
  const H = 112 + 14 + LIST_H + 16 + FOOTER_H;
  const c = beginCard(canvas, H);
  const { ctx, th } = c;

  accentBar(c, '#34d399', '#4fa3f7');
  const contentY = header(
    c,
    'Мой путь',
    `${total} ${pluralEntries(total)} заботы о себе · последние шаги`,
  );

  const DATE_W = 86;
  rows.forEach((row, i) => {
    const y = contentY + 14 + i * ROW_H + ROW_H / 2;

    // Дата слева — колонка таймлайна
    ctx.font = cardFont(11);
    ctx.fillStyle = th.fg(0.38);
    ctx.textAlign = 'left';
    ctx.fillText(row.day, CARD_PAD, y + 4);

    // Цветная точка группы
    ctx.fillStyle = row.hex;
    ctx.beginPath();
    ctx.arc(CARD_PAD + DATE_W, y, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Эмодзи + название
    ctx.font = '16px serif';
    ctx.fillStyle = th.fg(0.95);
    ctx.fillText(row.emoji, CARD_PAD + DATE_W + 14, y + 6);
    ctx.font = cardFont(14, 'bold');
    ctx.fillText(row.label, CARD_PAD + DATE_W + 40, y + 5);

    // Тонкая линия таймлайна между точками
    if (i < rows.length - 1) {
      ctx.strokeStyle = th.fg(0.08);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(CARD_PAD + DATE_W, y + 6);
      ctx.lineTo(CARD_PAD + DATE_W, y + ROW_H - 6);
      ctx.stroke();
    }
  });

  footer(c, 'Мой путь');
}

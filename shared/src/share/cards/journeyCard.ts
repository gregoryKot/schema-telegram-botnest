// Карточка «Мой путь» — лента последних шагов ПО ВРЕМЕНИ: вертикальная
// рельса-таймлайн, на ней узлы цвета группы, дата слева от рельсы, эмодзи и
// название — справа. Итог («N шагов») — в подзаголовке. Строки готовит
// buildJourneyCardRows (чистая, тестируется без canvas).
import {
  drawEmoji,
  CARD_PAD,
  FOOTER_H,
  beginCard,
  header,
  headerHeight,
  footer,
  cardFont,
  withAlpha,
} from '../cardKit';
import type { JourneyCardRow } from '../../journey/journeyMeta';
import { pluralEntries } from '../shareTexts';

// Больше строк карточка не вмещает — buildJourneyCardRows режет по нему.
export const JOURNEY_CARD_MAX_ROWS = 8;

const ROW_H = 46;
const RAIL_X = CARD_PAD + 70;

/** Высота карточки — чистая формула (тестируется без canvas). */
export function journeyCardHeight(
  rows: readonly unknown[],
  subtitle?: string,
): number {
  const bodyH = rows.length ? rows.length * ROW_H : 44;
  return headerHeight(1, Boolean(subtitle)) + bodyH + 16 + FOOTER_H;
}

export function drawJourneyCard(
  canvas: HTMLCanvasElement,
  rows: JourneyCardRow[],
  total: number,
  title = 'Мой путь',
  subtitle?: string,
) {
  const sub =
    subtitle ??
    `${total} ${pluralEntries(total)} заботы о себе · последние шаги`;
  const H = journeyCardHeight(rows, sub);
  const c = beginCard(canvas, H, {
    accent: 'var(--accent-green)',
    accent2: 'var(--accent-blue)',
  });
  const { ctx, th } = c;

  const contentY = header(c, { eyebrow: 'Мой путь', title, subtitle: sub });

  if (!rows.length) {
    ctx.font = cardFont(13);
    ctx.fillStyle = th.fg(0.4);
    ctx.fillText('Пока нет ни одного шага', CARD_PAD, contentY + 18);
    footer(c, 'Мой путь');
    return;
  }

  const top = contentY + 4;
  const nodeY = rows.map((_, i) => top + i * ROW_H + ROW_H / 2);

  // Рельса — градиент от акцента к второму цвету, полупрозрачная
  const grad = ctx.createLinearGradient(
    0,
    nodeY[0],
    0,
    nodeY[nodeY.length - 1],
  );
  grad.addColorStop(0, withAlpha(c.accent, 0.35));
  grad.addColorStop(1, withAlpha(c.accent2, 0.35));
  ctx.strokeStyle = grad;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(RAIL_X, nodeY[0]);
  ctx.lineTo(RAIL_X, nodeY[nodeY.length - 1]);
  ctx.stroke();

  rows.forEach((row, i) => {
    const mid = nodeY[i];

    // Дата слева — right-align к рельсе
    ctx.font = cardFont(10.5);
    ctx.fillStyle = th.fg(0.4);
    ctx.textAlign = 'right';
    ctx.fillText(row.day, RAIL_X - 12, mid + 4);

    // Узел: подложка цвета фона (рельса не просвечивает) + точка группы
    ctx.fillStyle = th.bg;
    ctx.beginPath();
    ctx.arc(RAIL_X, mid, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = row.hex;
    ctx.beginPath();
    ctx.arc(RAIL_X, mid, 5, 0, Math.PI * 2);
    ctx.fill();

    // Эмодзи + название справа от рельсы
    ctx.textAlign = 'left';
    drawEmoji(c, row.emoji, RAIL_X + 16, mid + 6, 16);
    ctx.font = cardFont(14, 'bold');
    ctx.fillStyle = th.fg(0.9);
    ctx.fillText(row.label, RAIL_X + 40, mid + 5);
  });

  footer(c, 'Мой путь');
}

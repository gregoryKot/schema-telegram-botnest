// Карточка месяца: сетка активности за последние 4 недели (7×4) + счётчики.
// Чистая подготовка сетки (buildMonthGrid) тестируется без canvas.
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

export interface MonthGrid {
  /** 28 ячеек, старые → новые; true = день с записью */
  cells: boolean[];
  activeDays: number;
}

/** Последние 28 дней (включая today) из набора дат YYYY-MM-DD. Чистая. */
export function buildMonthGrid(
  activeDates: ReadonlySet<string>,
  todayIso: string,
): MonthGrid {
  const today = new Date(`${todayIso}T00:00:00Z`);
  const cells: boolean[] = [];
  for (let back = 27; back >= 0; back--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - back);
    cells.push(activeDates.has(d.toISOString().slice(0, 10)));
  }
  return { cells, activeDays: cells.filter(Boolean).length };
}

export function drawMonthCard(
  canvas: HTMLCanvasElement,
  grid: MonthGrid,
  totalDays: number,
  rangeLabel: string,
) {
  const CELL = 34;
  const GAP = 8;
  const GRID_W = 7 * CELL + 6 * GAP;
  const GRID_H = 4 * CELL + 3 * GAP;
  const H = 120 + GRID_H + 24 + 78 + FOOTER_H - 36;
  const c = beginCard(canvas, H);
  const { ctx, W, th } = c;

  accentBar(c);
  header(c, 'Мой месяц', rangeLabel);

  // Сетка 7×4: старые сверху-слева → новые снизу-справа
  const gx = (W - GRID_W) / 2;
  const gy = 116;
  grid.cells.forEach((on, i) => {
    const col = i % 7;
    const row = Math.floor(i / 7);
    const x = gx + col * (CELL + GAP);
    const y = gy + row * (CELL + GAP);
    ctx.fillStyle = on ? th.accent : th.fg(0.07);
    ctx.beginPath();
    ctx.roundRect(x, y, CELL, CELL, 9);
    ctx.fill();
  });

  const statsDivY = gy + GRID_H + 22;
  divider(c, statsDivY);
  const statsY = statsDivY + 22;

  ctx.font = cardFont(11);
  ctx.fillStyle = th.fg(0.35);
  ctx.textAlign = 'left';
  ctx.fillText('Дней с записями', CARD_PAD, statsY);
  ctx.font = cardFont(26, 'bold');
  ctx.fillStyle = th.fg(0.95);
  ctx.fillText(`${grid.activeDays} из 28`, CARD_PAD, statsY + 30);

  if (totalDays > 0) {
    ctx.textAlign = 'right';
    ctx.font = cardFont(11);
    ctx.fillStyle = th.fg(0.35);
    ctx.fillText('Всего в приложении', W - CARD_PAD, statsY);
    ctx.font = cardFont(26, 'bold');
    ctx.fillStyle = th.fg(0.95);
    ctx.fillText(String(totalDays), W - CARD_PAD, statsY + 30);
    ctx.textAlign = 'left';
  }

  footer(c, 'Трекер потребностей');
}

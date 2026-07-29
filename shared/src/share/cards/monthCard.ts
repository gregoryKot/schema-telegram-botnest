// Карточка месяца: сетка активности за последние 4 недели (7×4) + счётчики.
// Чистая подготовка сетки (buildMonthGrid) тестируется без canvas.
import {
  FOOTER_H,
  beginCard,
  header,
  headerHeight,
  footer,
  cardFont,
  withAlpha,
  drawStatTiles,
  type StatTile,
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

const CELL = 40;
const GAP = 10;
const GRID_W = 7 * CELL + 6 * GAP;
const GRID_H = 4 * CELL + 3 * GAP;
const WEEKDAY_ROW_H = 24;
const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export function drawMonthCard(
  canvas: HTMLCanvasElement,
  grid: MonthGrid,
  totalDays: number,
  rangeLabel: string,
) {
  const H =
    headerHeight(1, true) + WEEKDAY_ROW_H + GRID_H + 20 + 66 + 16 + FOOTER_H;
  const c = beginCard(canvas, H, {
    accent: 'var(--accent-blue)',
    accent2: 'var(--accent)',
  });
  const { ctx, th } = c;

  const contentY = header(c, {
    eyebrow: 'Трекер потребностей',
    title: 'Мой месяц',
    subtitle: rangeLabel,
  });

  const gx = (c.W - GRID_W) / 2;

  ctx.font = cardFont(9, 'bold');
  ctx.fillStyle = th.fg(0.3);
  ctx.textAlign = 'center';
  WEEKDAYS.forEach((label, i) => {
    const wx = gx + i * (CELL + GAP) + CELL / 2;
    ctx.fillText(label, wx, contentY + 9);
  });
  ctx.textAlign = 'left';

  const gy = contentY + WEEKDAY_ROW_H;
  grid.cells.forEach((on, i) => {
    const col = i % 7;
    const row = Math.floor(i / 7);
    const x = gx + col * (CELL + GAP);
    const y = gy + row * (CELL + GAP);
    if (on) {
      ctx.save();
      ctx.shadowColor = withAlpha(c.accent, 0.5);
      ctx.shadowBlur = 10;
      const grad = ctx.createLinearGradient(x, y, x, y + CELL);
      grad.addColorStop(0, c.accent);
      grad.addColorStop(1, withAlpha(c.accent, 0.72));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(x, y, CELL, CELL, 10);
      ctx.fill();
      ctx.restore();
    } else {
      ctx.fillStyle = th.fg(0.06);
      ctx.beginPath();
      ctx.roundRect(x, y, CELL, CELL, 10);
      ctx.fill();
    }
  });

  const tiles: StatTile[] = [
    { label: 'Дней с записями', value: `${grid.activeDays} из 28` },
  ];
  if (totalDays > 0) {
    tiles.push({
      label: 'В приложении',
      value: String(totalDays),
      hint: 'дней',
    });
  }
  drawStatTiles(c, tiles, gy + GRID_H + 20);

  footer(c, 'Трекер потребностей');
}

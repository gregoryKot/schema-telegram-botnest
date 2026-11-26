// Карточка месяца: сетка активности за последние 4 недели (7×4) + счётчики.
// Чистая подготовка сетки (buildMonthGrid) тестируется без canvas.
// Лист соломы трекера, клетки — оттенки мха, как теплокарта «Активности» профиля.
import {
  CARD_LOOK,
  FOOTER_H,
  PAPER_INK,
  INK,
  STAT_TILE_H,
  beginCard,
  header,
  headerHeight,
  footer,
  cardFont,
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

const CELL = 38;
const GAP = 8;
const GRID_W = 7 * CELL + 6 * GAP;
const GRID_H = 4 * CELL + 3 * GAP;
const WEEKDAY_ROW_H = 22;
const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
/** Клетка дня с записью — мох (--c-moss, оттенок теплокарты профиля), сплошной, без свечения:
 *  светлый тон теплокарты .cpf-heat--2 на соломе читался ярко-зелёным пятном. */
const HEAT_ON = PAPER_INK.moss;

/** Высота карточки месяца — чистая. */
export const monthCardHeight = () =>
  headerHeight(1, true) +
  WEEKDAY_ROW_H +
  GRID_H +
  20 +
  STAT_TILE_H +
  14 +
  FOOTER_H;

export function drawMonthCard(
  canvas: HTMLCanvasElement,
  grid: MonthGrid,
  totalDays: number,
  rangeLabel: string,
) {
  const c = beginCard(canvas, monthCardHeight(), {
    hue: CARD_LOOK.tracker.hue,
  });
  const { ctx } = c;

  const contentY = header(c, {
    eyebrow: 'Трекер потребностей',
    title: 'Мой месяц',
    subtitle: rangeLabel,
    sign: CARD_LOOK.tracker.sign,
  });

  const gx = (c.W - GRID_W) / 2;

  ctx.font = cardFont(10, 'bold');
  ctx.fillStyle = INK.sub;
  ctx.textAlign = 'center';
  WEEKDAYS.forEach((label, i) => {
    ctx.fillText(label, gx + i * (CELL + GAP) + CELL / 2, contentY + 9);
  });
  ctx.textAlign = 'left';

  // Клетки — бумага: день с записью — мох, пустой — тон бумаги глубже.
  const gy = contentY + WEEKDAY_ROW_H;
  grid.cells.forEach((on, i) => {
    const x = gx + (i % 7) * (CELL + GAP);
    const y = gy + Math.floor(i / 7) * (CELL + GAP);
    ctx.fillStyle = on ? HEAT_ON : c.sunk;
    ctx.beginPath();
    ctx.roundRect(x, y, CELL, CELL, 9);
    ctx.fill();
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

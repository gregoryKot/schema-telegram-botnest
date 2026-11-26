// Семь маленьких листов-дней карточки недели (мотив SceneCheckIn / Strokes values): на каждом
// пять полосок по оценкам цветами данных потребностей, день без записи — пустой лист бумаги.
import type { Need, DayHistory } from '../../types';
import { shiftCalendarDay } from '../../utils/calendarDate';
import {
  CARD_PAD,
  INK,
  cardFont,
  inkAlpha,
  needDataInk,
  type Card,
} from '../cardKit';

export interface WeekDay {
  /** YYYY-MM-DD */
  date: string;
  /** Оценки дня; null — день без записи. */
  ratings: Record<string, number> | null;
}

/**
 * Семь календарных дней недели, кончая последним отмеченным: день без записи остаётся
 * пустым листом (ratings null), а не выпадает. Чистая.
 */
export function weekDays(history: DayHistory[]): WeekDay[] {
  if (history.length === 0) return [];
  const byDate = new Map(history.map((d) => [d.date, d.ratings]));
  const dates = [...byDate.keys()].sort();
  const last = dates[dates.length - 1];
  return Array.from({ length: 7 }, (_, i) => {
    const date = shiftCalendarDay(last, i - 6);
    return { date, ratings: byDate.get(date) ?? null };
  });
}

const DAY_W = 40;
const DAY_H = 66;
const DAY_CAP = 22;
/** Высота ряда листов-дней с подписью числа. */
export const WEEK_SHEETS_H = DAY_H + DAY_CAP;
const STROKE_W = 5;
const STROKE_MAX = 46;
/** Маленький лист дня: пять полосок по оценкам (мотив Strokes values), пустое — паз. */
function drawDaySheet(
  c: Card,
  needs: Need[],
  day: WeekDay,
  x: number,
  y: number,
) {
  const { ctx } = c;
  ctx.fillStyle = c.sunk;
  ctx.beginPath();
  ctx.roundRect(x + 2, y + 3, DAY_W, DAY_H, 8);
  ctx.fill();
  ctx.fillStyle = day.ratings ? INK.surface : c.paper;
  ctx.beginPath();
  ctx.roundRect(x, y, DAY_W, DAY_H, 8);
  ctx.fill();
  const step = (DAY_W - 10 - STROKE_W) / 4;
  needs.slice(0, 5).forEach((n, i) => {
    const v = day.ratings?.[n.id];
    const rated = v !== undefined && v > 0;
    const h = rated
      ? Math.max(STROKE_W + 2, (Math.min(10, v) / 10) * STROKE_MAX)
      : 8;
    ctx.fillStyle = rated ? (needDataInk(n.id) ?? INK.sub) : inkAlpha(0.12);
    ctx.beginPath();
    ctx.roundRect(
      x + 5 + i * step,
      y + DAY_H - 8 - h,
      STROKE_W,
      h,
      STROKE_W / 2,
    );
    ctx.fill();
  });
  ctx.font = cardFont(11.5);
  ctx.fillStyle = INK.sub;
  ctx.textAlign = 'center';
  ctx.fillText(
    String(Number(day.date.slice(8, 10))),
    x + DAY_W / 2,
    y + DAY_H + 17,
  );
  ctx.textAlign = 'left';
}

/** Ряд из семи листов-дней от y по ширине поля карточки. */
export function drawWeekSheets(
  c: Card,
  needs: Need[],
  history: DayHistory[],
  y: number,
) {
  const col = (c.W - CARD_PAD * 2) / 7;
  weekDays(history).forEach((day, i) =>
    drawDaySheet(c, needs, day, CARD_PAD + col * i + (col - DAY_W) / 2 - 1, y),
  );
}

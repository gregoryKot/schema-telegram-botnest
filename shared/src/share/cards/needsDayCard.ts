// Карточка дня потребностей — общая для дня трекера и шага «Мой день» в «Моём пути»
// (одна механика — один компонент): лист шалфея, как экран «Готово» трекера, — крупный индекс
// дня Literata, пять столбиков цветами данных потребностей (DayBars) со знаком потребности под
// каждым и строки с точными оценками. Пропущенная потребность — пустой паз и «—», не ноль.
import {
  CARD_PAD,
  DAY_DONE_HUE,
  FOOTER_H,
  INK,
  NEED_ROW_H,
  beginCard,
  cardFont,
  dayBarsHeight,
  drawDayBars,
  drawNeedRow,
  footer,
  header,
  headerHeight,
  serifFont,
} from '../cardKit';

export interface NeedsDayRow {
  /** id потребности: знак и цвет данных — по нему. */
  id: string;
  label: string;
  /** 0..10; null — потребность не отмечена. */
  value: number | null;
  /** Отформатированное значение: «7» для дня, «—» без данных. */
  valueText: string;
}

export interface NeedsDayCardData {
  eyebrow: string;
  title: string;
  subtitle?: string;
  rows: NeedsDayRow[];
  /** Крупное значение — индекс дня. */
  center: { value: string; caption: string };
  footerLabel: string;
}

const INDEX_H = 66;
const BAR_H = 112;
const BARS_GAP = 22;

/** Высота карточки — чистая формула (тестируется без canvas). */
export function needsDayCardHeight(d: {
  rows: unknown[];
  subtitle?: string;
}): number {
  return (
    headerHeight(1, Boolean(d.subtitle)) +
    INDEX_H +
    dayBarsHeight(BAR_H) +
    BARS_GAP +
    d.rows.length * NEED_ROW_H +
    10 +
    FOOTER_H
  );
}

export function drawNeedsDayCard(
  canvas: HTMLCanvasElement,
  d: NeedsDayCardData,
) {
  const c = beginCard(canvas, needsDayCardHeight(d), { hue: DAY_DONE_HUE });
  const { ctx } = c;
  const top = header(c, {
    eyebrow: d.eyebrow,
    title: d.title,
    subtitle: d.subtitle,
    sign: 'strokes',
  });

  // Индекс дня — как на «Готово»: число Literata и подпись рядом.
  ctx.textAlign = 'left';
  ctx.font = serifFont(52);
  ctx.fillStyle = INK.text;
  ctx.fillText(d.center.value, CARD_PAD, top + 44);
  const w = ctx.measureText(d.center.value).width;
  ctx.font = cardFont(13);
  ctx.fillStyle = INK.sub;
  ctx.fillText(d.center.caption, CARD_PAD + w + 10, top + 44);

  const barsW = c.W - CARD_PAD * 2;
  let y =
    drawDayBars(c, d.rows, CARD_PAD, top + INDEX_H, barsW, BAR_H) + BARS_GAP;
  for (const row of d.rows) {
    drawNeedRow(c, row, y);
    y += NEED_ROW_H;
  }
  footer(c, d.footerLabel);
}

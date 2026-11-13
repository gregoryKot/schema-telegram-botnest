// Карточка недели трекера потребностей; числа — fmtIndex. Чистые расчёты
// (calcWeekAvg, weekIndex, weekRange, buildWeeklyShareText) экспортируются для тестов.
// Лист соломы трекера: семь маленьких листов-дней (weekSheets.ts) с пятью полосками по оценкам, индекс
// недели и средние по потребностям строками, серия — числом (без эмодзи).
import type { Need, DayHistory } from '../../types';
import { fmtIndex } from '../../needs/dayIndex';
import { fmtDate } from '../../utils/format';
import { drawWeekSheets, WEEK_SHEETS_H } from './weekSheets';
import { pluralDays } from '../../utils/celebrationText';
import {
  CARD_LOOK,
  CARD_PAD,
  FOOTER_H,
  INK,
  NEED_ROW_H,
  STAT_TILE_H,
  beginCard,
  cardFont,
  drawNeedRow,
  drawStatTiles,
  footer,
  header,
  headerHeight,
  serifFont,
  type StatTile,
} from '../cardKit';

export function calcWeekAvg(
  history: DayHistory[],
  needId: string,
): number | null {
  const vals = history
    .map((d) => d.ratings[needId])
    .filter((v): v is number => v !== undefined);
  if (vals.length === 0) return null;
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}

export function weekRange(history: DayHistory[]): string {
  const sorted = [...history].map((d) => d.date).sort();
  if (sorted.length >= 2)
    return `${fmtDate(sorted[0])} — ${fmtDate(sorted[sorted.length - 1])}`;
  return sorted.length === 1 ? fmtDate(sorted[0]) : '';
}

export function weekIndex(needs: Need[], history: DayHistory[]): number | null {
  const avgs = needs
    .map((n) => calcWeekAvg(history, n.id))
    .filter((v): v is number => v !== null);
  if (avgs.length === 0) return null;
  return avgs.reduce((s, v) => s + v, 0) / avgs.length;
}

export function buildWeeklyShareText(
  needs: Need[],
  history: DayHistory[],
  streak: number,
  detailed: boolean,
  link: string,
): string {
  const idx = weekIndex(needs, history);
  const idxStr = fmtIndex(idx);
  const range = weekRange(history);
  const streakSuffix = streak > 0 ? ` · Серия: ${streak} дней 🔥` : '';
  if (!detailed)
    return `Мой трекер потребностей за неделю ${range}\nИндекс: ${idxStr}/10${streakSuffix}\n${link}`;
  const rows = needs
    .map((n) => {
      const avg = calcWeekAvg(history, n.id);
      return `${n.emoji} ${n.chartLabel}: ${fmtIndex(avg)}`;
    })
    .join('\n');
  return `Трекер потребностей · ${range}\n\n${rows}\n\nИндекс: ${idxStr}/10${streakSuffix}\n\n${link}`;
}

const INDEX_H = 70;

/** Высота карточки недели — чистая формула от числа потребностей и плиток. */
export function weeklyCardHeight(
  needCount: number,
  hasRange: boolean,
  tiles: number,
): number {
  return (
    headerHeight(1, hasRange) +
    WEEK_SHEETS_H +
    INDEX_H +
    needCount * NEED_ROW_H +
    (tiles ? 14 + STAT_TILE_H : 0) +
    12 +
    FOOTER_H
  );
}

export function drawWeeklyCard(
  canvas: HTMLCanvasElement,
  needs: Need[],
  history: DayHistory[],
  streak: number,
) {
  const idx = weekIndex(needs, history);
  const range = weekRange(history);
  const tiles: StatTile[] = [
    {
      label: 'Дней отмечено',
      value: String(history.length),
      hint: pluralDays(history.length),
    },
    ...(streak > 0
      ? [{ label: 'Серия', value: String(streak), hint: pluralDays(streak) }]
      : []),
  ];
  const H = weeklyCardHeight(needs.length, Boolean(range), tiles.length);
  const c = beginCard(canvas, H, { hue: CARD_LOOK.tracker.hue });
  const { ctx } = c;
  const top = header(c, {
    eyebrow: 'Трекер потребностей',
    title: 'Моя неделя',
    subtitle: range || undefined,
    sign: CARD_LOOK.tracker.sign,
  });

  drawWeekSheets(c, needs, history, top);

  let y = top + WEEK_SHEETS_H;
  ctx.font = serifFont(40);
  ctx.fillStyle = INK.text;
  ctx.fillText(fmtIndex(idx), CARD_PAD, y + 50);
  const w = ctx.measureText(fmtIndex(idx)).width;
  ctx.font = cardFont(13);
  ctx.fillStyle = INK.sub;
  ctx.fillText('индекс', CARD_PAD + w + 10, y + 50);
  y += INDEX_H;

  for (const n of needs) {
    const avg = calcWeekAvg(history, n.id);
    drawNeedRow(
      c,
      { id: n.id, label: n.chartLabel, value: avg, valueText: fmtIndex(avg) },
      y,
    );
    y += NEED_ROW_H;
  }
  if (tiles.length) drawStatTiles(c, tiles, y + 14);

  footer(c, 'Трекер потребностей');
}

export { weekDays, type WeekDay } from './weekSheets';

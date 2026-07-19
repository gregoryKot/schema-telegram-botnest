// Карточка одного дня трекера потребностей («заполнил день → поделись»).
// Как weeklyCard, но значения — оценки за конкретный день, а не средние.
// Общая копия для обоих фронтендов (правило №3). Чистый билдер текста
// экспортируется для тестов.
import { COLORS } from '../../types';
import type { Need } from '../../types';
import {
  ROW_H,
  beginCard,
  accentBar,
  header,
  divider,
  footer,
  drawNeedRows,
  drawIndexStat,
} from '../cardKit';

export function dayIndex(
  needs: Need[],
  ratings: Record<string, number>,
): number | null {
  const vals = needs
    .map((n) => ratings[n.id])
    .filter((v): v is number => v !== undefined);
  if (vals.length === 0) return null;
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}

export function buildDayShareText(
  needs: Need[],
  ratings: Record<string, number>,
  dateLabel: string,
  link: string,
): string {
  const idx = dayIndex(needs, ratings);
  const idxStr = idx !== null ? idx.toFixed(1) : '—';
  return `Мои потребности сегодня, ${dateLabel}\nИндекс дня: ${idxStr}/10\n${link}`;
}

/**
 * Готовый набор пропсов для ShareCardSheet карточки дня — единственная копия
 * для DayShareButton обоих фронтендов (во фронте остаётся только вёрстка).
 * dateLabel — уже отформатированная дата («17 июл»), link — botShortUrl фронта.
 */
export function makeDayShare(
  needs: Need[],
  ratings: Record<string, number>,
  dateLabel: string,
  link: string,
): {
  title: string;
  draw: (canvas: HTMLCanvasElement) => void;
  shareText: string;
  filename: string;
  eventKind: 'day';
} {
  return {
    title: 'Карточка дня',
    draw: (canvas) => drawDayCard(canvas, needs, ratings, dateLabel),
    shareText: buildDayShareText(needs, ratings, dateLabel, link),
    filename: 'needs-day.png',
    eventKind: 'day',
  };
}

export function drawDayCard(
  canvas: HTMLCanvasElement,
  needs: Need[],
  ratings: Record<string, number>,
  dateLabel: string,
) {
  const H = 120 + needs.length * ROW_H + 8 + 96 + 56;
  const c = beginCard(canvas, H);

  accentBar(c);
  header(c, 'Потребности сегодня', dateLabel);

  drawNeedRows(
    c,
    needs.map((n) => {
      const val = ratings[n.id];
      return {
        emoji: n.emoji,
        chartLabel: n.chartLabel,
        color: COLORS[n.id] ?? '#888',
        value: val ?? null,
        valueText: val !== undefined ? String(val) : '—',
      };
    }),
  );

  const statsDivY = 112 + needs.length * ROW_H + 8;
  divider(c, statsDivY);
  drawIndexStat(c, 'Индекс дня', dayIndex(needs, ratings) ?? 0, statsDivY + 20);

  footer(c, 'Трекер потребностей');
}

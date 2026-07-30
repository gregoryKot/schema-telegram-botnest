// Карточка одного дня трекера потребностей («заполнил день → поделись»).
// Как weeklyCard, но значения — оценки за конкретный день, а не средние.
// Общая копия для обоих фронтендов (правило №3). Чистый билдер текста
// экспортируется для тестов.
import { COLORS } from '../../types';
import type { Need } from '../../types';
import { drawNeedsRadarCard, type NeedsRadarRow } from './needsRadarCard';

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

/** Строки радара из потребностей и оценок — общая часть дня и «Моего пути». */
export function dayRadarRows(
  needs: Need[],
  ratings: Record<string, number>,
): NeedsRadarRow[] {
  return needs.map((n) => {
    const val = ratings[n.id];
    return {
      emoji: n.emoji,
      label: n.chartLabel,
      color: COLORS[n.id] ?? '#888',
      value: val ?? null,
      valueText: val !== undefined ? String(val) : '—',
    };
  });
}

export function drawDayCard(
  canvas: HTMLCanvasElement,
  needs: Need[],
  ratings: Record<string, number>,
  dateLabel: string,
) {
  const idx = dayIndex(needs, ratings);
  drawNeedsRadarCard(canvas, {
    eyebrow: 'Трекер потребностей',
    title: 'Мой день',
    subtitle: dateLabel,
    rows: dayRadarRows(needs, ratings),
    center: {
      value: idx !== null ? idx.toFixed(1) : '—',
      caption: 'индекс',
    },
    footerLabel: 'Трекер потребностей',
    accent: 'var(--accent-blue)',
    accent2: 'var(--accent)',
  });
}

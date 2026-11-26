// Карточка одного дня трекера потребностей («заполнил день → поделись»).
// Лист «Готово» трекера: индекс и пять столбиков дня (needsDayCard.ts); числа — fmtIndex.
// Чистый билдер текста экспортируется для тестов.
import type { Need } from '../../types';
import { fmtIndex } from '../../needs/dayIndex';
import { drawNeedsDayCard, type NeedsDayRow } from './needsDayCard';

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
  const idxStr = fmtIndex(idx);
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

/** Строки карточки дня из потребностей и оценок. Чистая. */
export function dayNeedRows(
  needs: Need[],
  ratings: Record<string, number>,
): NeedsDayRow[] {
  return needs.map((n) => {
    const val = ratings[n.id];
    return {
      id: n.id,
      label: n.chartLabel,
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
  drawNeedsDayCard(canvas, {
    eyebrow: 'Трекер потребностей',
    title: 'Мой день',
    subtitle: dateLabel,
    rows: dayNeedRows(needs, ratings),
    center: {
      value: fmtIndex(idx),
      caption: 'индекс',
    },
    footerLabel: 'Трекер потребностей',
  });
}

// Карточка недели трекера потребностей — единственная копия для обоих
// фронтендов. Чистые расчёты (calcWeekAvg, weekIndex, weekRange,
// buildWeeklyShareText) экспортируются для тестов.
import { COLORS } from '../../types';
import type { Need, DayHistory } from '../../types';
import { fmtDate } from '../../utils/format';
import { drawNeedsRadarCard } from './needsRadarCard';
import { pluralDays } from '../../utils/celebrationText';

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
  const idxStr = idx !== null ? idx.toFixed(1) : '—';
  const range = weekRange(history);
  const streakSuffix = streak > 0 ? ` · Серия: ${streak} дней 🔥` : '';
  if (!detailed)
    return `Мой трекер потребностей за неделю ${range}\nИндекс: ${idxStr}/10${streakSuffix}\n${link}`;
  const rows = needs
    .map((n) => {
      const avg = calcWeekAvg(history, n.id);
      return `${n.emoji} ${n.chartLabel}: ${avg !== null ? avg.toFixed(1) : '—'}`;
    })
    .join('\n');
  return `Трекер потребностей · ${range}\n\n${rows}\n\nИндекс: ${idxStr}/10${streakSuffix}\n\n${link}`;
}

export function drawWeeklyCard(
  canvas: HTMLCanvasElement,
  needs: Need[],
  history: DayHistory[],
  streak: number,
) {
  const idx = weekIndex(needs, history);
  drawNeedsRadarCard(canvas, {
    eyebrow: 'Трекер потребностей',
    title: 'Моя неделя',
    subtitle: weekRange(history),
    rows: needs.map((n) => {
      const avg = calcWeekAvg(history, n.id);
      return {
        emoji: n.emoji,
        label: n.chartLabel,
        color: COLORS[n.id] ?? '#888',
        value: avg,
        valueText: avg !== null ? avg.toFixed(1) : '—',
      };
    }),
    center: { value: idx !== null ? idx.toFixed(1) : '—', caption: 'индекс' },
    tiles: [
      {
        label: 'Дней отмечено',
        value: String(history.length),
        hint: pluralDays(history.length),
      },
      ...(streak > 0
        ? [
            {
              label: 'Серия',
              value: `${streak} 🔥`,
              color: 'var(--accent-orange)',
            },
          ]
        : []),
    ],
    footerLabel: 'Трекер потребностей',
    accent: 'var(--accent)',
    accent2: 'var(--accent-blue)',
  });
}

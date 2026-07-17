// Карточка недели трекера потребностей — единственная копия для обоих
// фронтендов. Чистые расчёты (calcWeekAvg, weekIndex, weekRange,
// buildWeeklyShareText) экспортируются для тестов.
import { COLORS } from '../../types';
import type { Need, DayHistory } from '../../types';
import { fmtDate } from '../../utils/format';
import {
  CARD_PAD,
  ROW_H,
  beginCard,
  accentBar,
  header,
  divider,
  footer,
  cardFont,
  drawNeedRows,
  drawIndexStat,
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
  const H = 120 + needs.length * ROW_H + 8 + 96 + 56;
  const c = beginCard(canvas, H);
  const { ctx, W, th } = c;

  accentBar(c);
  header(c, 'Трекер потребностей', weekRange(history));

  drawNeedRows(
    c,
    needs.map((n) => {
      const avg = calcWeekAvg(history, n.id);
      return {
        emoji: n.emoji,
        chartLabel: n.chartLabel,
        color: COLORS[n.id] ?? '#888',
        value: avg,
        valueText: avg !== null ? avg.toFixed(1) : '—',
      };
    }),
  );

  const statsDivY = 112 + needs.length * ROW_H + 8;
  divider(c, statsDivY);

  const statsY = statsDivY + 20;
  drawIndexStat(c, 'Индекс недели', weekIndex(needs, history) ?? 0, statsY);

  if (streak > 0) {
    ctx.textAlign = 'right';
    ctx.font = cardFont(11);
    ctx.fillStyle = th.fg(0.35);
    ctx.fillText('Серия дней', W - CARD_PAD, statsY);

    ctx.font = cardFont(26, 'bold');
    ctx.fillStyle = th.fg(0.95);
    ctx.fillText(`${streak} 🔥`, W - CARD_PAD, statsY + 30);
    ctx.textAlign = 'left';
  }

  footer(c, 'Трекер потребностей');
}

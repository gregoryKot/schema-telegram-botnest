// Карточка недели трекера потребностей — единственная копия для обоих
// фронтендов. Чистые расчёты (calcWeekAvg, weekIndex, weekRange,
// buildWeeklyShareText) экспортируются для тестов.
import { COLORS } from '../../types';
import type { Need, DayHistory } from '../../types';
import { fmtDate } from '../../utils/format';
import {
  CARD_PAD,
  beginCard,
  accentBar,
  header,
  divider,
  footer,
  cardFont,
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
  const ROW_H = 44;
  const H = 120 + needs.length * ROW_H + 8 + 96 + 56;
  const c = beginCard(canvas, H);
  const { ctx, W, th } = c;

  accentBar(c);
  header(c, 'Трекер потребностей', weekRange(history));

  const BAR_MAX_W = 100;
  const BAR_X = W - CARD_PAD - BAR_MAX_W;
  const BAR_H = 7;

  needs.forEach((need, i) => {
    const rowY = 112 + i * ROW_H;
    const avg = calcWeekAvg(history, need.id);
    const color = COLORS[need.id] ?? '#888';

    ctx.font = '17px serif';
    ctx.fillStyle = th.fg(0.95);
    ctx.textAlign = 'left';
    ctx.fillText(need.emoji, CARD_PAD, rowY + 20);

    ctx.font = cardFont(13);
    ctx.fillStyle = th.fg(0.7);
    ctx.fillText(need.chartLabel, 52, rowY + 20);

    ctx.font = cardFont(14, 'bold');
    ctx.fillStyle = color;
    ctx.textAlign = 'right';
    ctx.fillText(avg !== null ? avg.toFixed(1) : '—', BAR_X - 12, rowY + 20);
    ctx.textAlign = 'left';

    ctx.fillStyle = th.fg(0.07);
    ctx.beginPath();
    ctx.roundRect(BAR_X, rowY + 12, BAR_MAX_W, BAR_H, 3.5);
    ctx.fill();

    if (avg !== null && avg > 0) {
      const fillW = Math.max(4, (avg / 10) * BAR_MAX_W);
      const barGrad = ctx.createLinearGradient(BAR_X, 0, BAR_X + fillW, 0);
      barGrad.addColorStop(0, color + 'aa');
      barGrad.addColorStop(1, color);
      ctx.fillStyle = barGrad;
      ctx.beginPath();
      ctx.roundRect(BAR_X, rowY + 12, fillW, BAR_H, 3.5);
      ctx.fill();
    }
  });

  const statsDivY = 112 + needs.length * ROW_H + 8;
  divider(c, statsDivY);

  const statsY = statsDivY + 20;
  const idx = weekIndex(needs, history) ?? 0;

  ctx.font = cardFont(11);
  ctx.fillStyle = th.fg(0.35);
  ctx.textAlign = 'left';
  ctx.fillText('Индекс недели', CARD_PAD, statsY);

  ctx.font = cardFont(26, 'bold');
  ctx.fillStyle = th.fg(0.95);
  ctx.fillText(idx.toFixed(1), CARD_PAD, statsY + 30);

  ctx.font = cardFont(11);
  ctx.fillStyle = th.fg(0.28);
  const idxW = ctx.measureText(idx.toFixed(1)).width;
  ctx.fillText('/10', CARD_PAD + idxW + 2, statsY + 24);

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

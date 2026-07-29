// Карточка итогов «Моего пути»: общий счётчик крупно, затем занятия по
// убыванию — каждое со своей полоской прогресса относительно самого частого.
// Дополняет карточку-ленту (journeyCard, последние шаги по времени).
// Строки — totalsCardRows (чистая, с тестами).
import {
  drawEmoji,
  CARD_PAD,
  FOOTER_H,
  beginCard,
  header,
  headerHeight,
  divider,
  footer,
  cardFont,
  progressBar,
} from '../cardKit';
import type { JourneyStatRow } from '../../journey/journeyStats';

export const JOURNEY_TOTALS_MAX_ROWS = 8;

const HERO_H = 70;
const ROW_H = 44;
const REST_H = 24;

/** Верхние строки + максимум (для полосок) + «и ещё N» хвостом. Чистая. */
export function totalsCardRows(stats: JourneyStatRow[]): {
  shown: JourneyStatRow[];
  restCount: number;
  max: number;
} {
  const shown = stats.slice(0, JOURNEY_TOTALS_MAX_ROWS);
  return {
    shown,
    restCount: Math.max(0, stats.length - JOURNEY_TOTALS_MAX_ROWS),
    max: shown.reduce((m, r) => Math.max(m, r.count), 0),
  };
}

/** Высота карточки — чистая формула. */
export function journeyTotalsCardHeight(
  shownCount: number,
  hasRest: boolean,
): number {
  return (
    headerHeight(1, true) +
    HERO_H +
    shownCount * ROW_H +
    (hasRest ? REST_H : 0) +
    10 +
    FOOTER_H
  );
}

export function drawJourneyTotalsCard(
  canvas: HTMLCanvasElement,
  stats: JourneyStatRow[],
  total: number,
) {
  const { shown, restCount, max } = totalsCardRows(stats);
  const H = journeyTotalsCardHeight(shown.length, restCount > 0);
  const c = beginCard(canvas, H, {
    accent: 'var(--accent)',
    accent2: 'var(--accent-green)',
  });
  const { ctx, W, th } = c;

  const contentY = header(c, {
    eyebrow: 'Мой путь',
    title: 'Итоги пути',
    subtitle: 'сколько чего накопилось',
  });

  // Общий итог крупно
  ctx.font = cardFont(34, 'bold');
  ctx.fillStyle = th.fg(0.96);
  ctx.textAlign = 'left';
  ctx.fillText(String(total), CARD_PAD, contentY + 28);
  const totalW = ctx.measureText(String(total)).width;
  ctx.font = cardFont(13);
  ctx.fillStyle = th.fg(0.5);
  ctx.fillText('записей всего', CARD_PAD + totalW + 12, contentY + 28);

  const listTop = contentY + HERO_H - 12;
  divider(c, listTop);

  let y = listTop + 22;
  shown.forEach((row) => {
    drawEmoji(c, row.emoji, CARD_PAD, y, 16);
    ctx.font = cardFont(14);
    ctx.fillStyle = th.fg(0.75);
    ctx.fillText(row.label, CARD_PAD + 26, y - 1);
    ctx.font = cardFont(16, 'bold');
    ctx.fillStyle = th.fg(0.96);
    ctx.textAlign = 'right';
    ctx.fillText(String(row.count), W - CARD_PAD, y);
    ctx.textAlign = 'left';

    progressBar(
      c,
      CARD_PAD,
      y + 10,
      W - CARD_PAD * 2,
      max > 0 ? row.count / max : 0,
      c.accent,
      4,
    );
    y += ROW_H;
  });

  if (restCount > 0) {
    ctx.font = cardFont(11);
    ctx.fillStyle = th.fg(0.35);
    ctx.fillText(
      `…и ещё ${restCount} ${restCount === 1 ? 'занятие' : restCount < 5 ? 'занятия' : 'занятий'}`,
      CARD_PAD,
      y + 4,
    );
  }

  footer(c, 'Мой путь');
}

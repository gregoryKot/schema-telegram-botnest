// Карточка итогов «Моего пути» (b23b): лист неба «Моего пути», число шагов Literata крупно,
// затем занятия по убыванию строками «знак → занятие → число» (знак — journeyStatLook, тот же,
// что у плитки счётчика в приложении) с тихой полосой чернилами листа относительно самого
// частого. Дополняет карточку-ленту (journeyCard). Строки — totalsCardRows (чистая, с тестами).
import {
  CARD_PAD,
  CARD_LOOK,
  FOOTER_H,
  INK,
  beginCard,
  canvasSign,
  cardFont,
  footer,
  header,
  headerLines,
  progressBar,
  serifFont,
  sign,
  signHeight,
  wrapClamp,
  type Card,
} from '../cardKit';
import type { JourneyStatRow } from '../../journey/journeyStats';
import { journeyStatLook } from '../../journey/journeyLook';

export const JOURNEY_TOTALS_MAX_ROWS = 8;

const HERO_H = 92;
const ROW_H = 46;
const REST_H = 24;
const SIGN_W = 36;
const SIGN_BOX = 22;
const LABEL_X = CARD_PAD + SIGN_W + 14;

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

/** Высота карточки по высоте шапки — чистая формула. */
export function journeyTotalsCardHeight(
  shownCount: number,
  hasRest: boolean,
  headH: number,
): number {
  // Пустая сводка — одна поясняющая строка вместо списка занятий.
  const bodyH = shownCount === 0 ? 34 : shownCount * ROW_H - 20;
  return headH + HERO_H + bodyH + (hasRest ? REST_H : 0) + FOOTER_H;
}

export interface JourneyTotalsOpts {
  /** «Мой месяц» — если сводка за период, а не за всё время. */
  title?: string;
  /** «за последние 30 дней · сколько чего накопилось» — если сводка за период. */
  subtitle?: string;
}

/** Знак занятия, вписанный в строку; знака нет — пустое место (без выдуманной картинки). */
function rowSign(c: Card, type: string, y: number) {
  const key = canvasSign(journeyStatLook(type)?.sign);
  if (!key) return;
  const h0 = signHeight(key, SIGN_W);
  const w = h0 > SIGN_BOX ? (SIGN_W * SIGN_BOX) / h0 : SIGN_W;
  const h = signHeight(key, w);
  sign(c, key, CARD_PAD + (SIGN_W - w) / 2, y - 8 - h / 2, w);
}

export function drawJourneyTotalsCard(
  canvas: HTMLCanvasElement,
  stats: JourneyStatRow[],
  total: number,
  opts: JourneyTotalsOpts = {},
) {
  const { shown, restCount, max } = totalsCardRows(stats);
  const look = CARD_LOOK.journey;
  const head = {
    eyebrow: 'Мой путь',
    title: opts.title ?? 'Итоги пути',
    subtitle: opts.subtitle ?? 'сколько чего накопилось',
    sign: look.sign,
  };
  const lines = headerLines(canvas.getContext('2d')!, head);
  const H = journeyTotalsCardHeight(shown.length, restCount > 0, lines.height);
  const c = beginCard(canvas, H, { hue: look.hue });
  const { ctx, W } = c;
  const top = header(c, head, lines);

  // Число шагов крупно, как у героя «Моего пути» в приложении.
  ctx.textAlign = 'left';
  ctx.font = serifFont(64);
  ctx.fillStyle = INK.text;
  ctx.fillText(String(total), CARD_PAD, top + 50);
  const totalW = ctx.measureText(String(total)).width;
  ctx.font = cardFont(14);
  ctx.fillStyle = INK.sub;
  ctx.fillText('записей всего', CARD_PAD + totalW + 12, top + 50);

  const listTop = top + HERO_H;
  if (shown.length === 0) {
    ctx.font = cardFont(14);
    ctx.fillStyle = INK.sub;
    ctx.fillText('Пока ни одного шага — самое начало', CARD_PAD, listTop + 4);
    footer(c, 'Мой путь');
    return;
  }

  const measure = (s: string) => ctx.measureText(s).width;
  let y = listTop;
  for (const row of shown) {
    rowSign(c, row.type, y);
    ctx.font = serifFont(19);
    const countW = measure(String(row.count));
    ctx.fillStyle = INK.text;
    ctx.textAlign = 'right';
    ctx.fillText(String(row.count), W - CARD_PAD, y);
    ctx.textAlign = 'left';
    ctx.font = cardFont(14);
    const [label] = wrapClamp(
      measure,
      row.label,
      W - CARD_PAD - LABEL_X - countW - 12,
      1,
    );
    ctx.fillText(label ?? '', LABEL_X, y - 1);
    progressBar(
      c,
      LABEL_X,
      y + 11,
      W - CARD_PAD - LABEL_X,
      max > 0 ? row.count / max : 0,
      c.accent,
      4,
    );
    y += ROW_H;
  }

  if (restCount > 0) {
    ctx.font = cardFont(12);
    ctx.fillStyle = INK.sub;
    ctx.fillText(
      `…и ещё ${restCount} ${restCount === 1 ? 'занятие' : restCount < 5 ? 'занятия' : 'занятий'}`,
      LABEL_X,
      y,
    );
  }

  footer(c, 'Мой путь');
}

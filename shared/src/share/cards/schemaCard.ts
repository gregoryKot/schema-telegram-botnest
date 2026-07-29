// Карточка схемы: домен, название, описание, типичное убеждение.
// Приватных данных нет — только справочный контент из данных фронтенда.
// Той же вёрсткой рисуется запись дневника режимов (modeEntryCard) — описание
// должно оставаться удобным для чтения свободного текста пользователя.
import {
  CARD_W,
  CARD_PAD,
  FOOTER_H,
  beginCard,
  header,
  headerHeight,
  footer,
  panel,
  measureWrap,
  drawWrapped,
  clampLines,
  cardFont,
  type Card,
} from '../cardKit';

export interface SchemaCardData {
  domain: string;
  /** CSS-переменная или hex — резолвится китом */
  domainColor: string;
  name: string;
  desc: string;
  belief?: string;
  /** Подпись в футере; по умолчанию «Схема-терапия» (для режимов — «Режимы») */
  footerLabel?: string;
}

const DESC_SIZE = 13.5;
const DESC_LINE_H = 21;
const DESC_MAX_LINES = 6;

const BELIEF_PAD_X = 16;
const BELIEF_PAD_Y = 14;
const BELIEF_BAR_W = 3;
const BELIEF_BAR_GAP = 11;
const BELIEF_LINE_H = 19;
const BELIEF_MAX_LINES = 4;
const BELIEF_GAP_TOP = 18;

export function drawSchemaCard(canvas: HTMLCanvasElement, d: SchemaCardData) {
  const maxW = CARD_W - CARD_PAD * 2;
  const nameLines = clampLines(
    measureWrap(canvas, d.name, maxW, 23, 'bold'),
    2,
  );
  const descLines = clampLines(
    measureWrap(canvas, d.desc, maxW, DESC_SIZE),
    DESC_MAX_LINES,
  );

  const beliefText = d.belief ? `«${d.belief}»` : '';
  const beliefMaxW = maxW - BELIEF_PAD_X * 2 - BELIEF_BAR_W - BELIEF_BAR_GAP;
  const beliefLines = beliefText
    ? clampLines(
        measureWrap(canvas, beliefText, beliefMaxW, 13),
        BELIEF_MAX_LINES,
      )
    : [];
  const beliefPanelH = beliefLines.length
    ? beliefLines.length * BELIEF_LINE_H + BELIEF_PAD_Y * 2
    : 0;

  const H =
    headerHeight(nameLines.length, false) +
    descLines.length * DESC_LINE_H +
    (beliefLines.length ? BELIEF_GAP_TOP + beliefPanelH : 0) +
    20 +
    FOOTER_H;

  const c = beginCard(canvas, H, {
    accent: d.domainColor,
    accent2: 'var(--accent)',
  });
  const { th } = c;

  const contentY = header(c, { eyebrow: d.domain, title: d.name });

  let y = drawWrapped(c, d.desc, CARD_PAD, contentY, maxW, {
    size: DESC_SIZE,
    color: th.fg(0.62),
    lineH: DESC_LINE_H,
    maxLines: DESC_MAX_LINES,
  });

  if (beliefLines.length) {
    y += BELIEF_GAP_TOP;
    drawBeliefPanel(c, y, maxW, beliefPanelH, beliefLines);
  }

  footer(c, d.footerLabel ?? 'Схема-терапия');
}

/** Панель убеждения: мягкая плашка + цветная полоска слева + курсивный текст. */
function drawBeliefPanel(
  c: Card,
  y: number,
  maxW: number,
  panelH: number,
  lines: string[],
) {
  const { ctx, th } = c;
  panel(c, CARD_PAD, y, maxW, panelH, 14);

  ctx.fillStyle = c.accent;
  ctx.beginPath();
  ctx.roundRect(
    CARD_PAD + BELIEF_PAD_X,
    y + BELIEF_PAD_Y - 3,
    BELIEF_BAR_W,
    panelH - (BELIEF_PAD_Y - 3) * 2,
    1.5,
  );
  ctx.fill();

  const textX = CARD_PAD + BELIEF_PAD_X + BELIEF_BAR_W + BELIEF_BAR_GAP;
  let by = y + BELIEF_PAD_Y + 11;
  ctx.textAlign = 'left';
  for (const line of lines) {
    ctx.font = `italic ${cardFont(13)}`;
    ctx.fillStyle = th.fg(0.55);
    ctx.fillText(line, textX, by);
    by += BELIEF_LINE_H;
  }
}

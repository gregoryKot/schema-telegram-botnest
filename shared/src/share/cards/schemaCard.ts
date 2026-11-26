// Карточка схемы: домен, название, описание, типичное убеждение.
// Приватных данных нет — только справочный контент из данных фронтенда.
// Той же вёрсткой рисуется запись дневника режимов (modeEntryCard) — описание
// должно оставаться удобным для чтения свободного текста пользователя.
// Лист бумаги домена (оттенок — по цвету домена/группы) со знаком сущности справа от
// названия; убеждение — светлая плашка с курсивом Literata, без цветной полоски.
import {
  CARD_W,
  CARD_PAD,
  FOOTER_H,
  INK,
  SERIF,
  beginCard,
  header,
  headerLines,
  footer,
  panel,
  measureClamp,
  drawWrapped,
  type HeaderOpts,
} from '../cardKit';

export interface SchemaCardData {
  domain: string;
  /** CSS-переменная или hex — по нему выбирается бумага листа */
  domainColor: string;
  name: string;
  desc: string;
  belief?: string;
  /** Подпись в футере; по умолчанию «Схема-терапия» (для режимов — «Режимы») */
  footerLabel?: string;
  /** Знак сущности (ключ ENTITY_LOOK); по умолчанию — схемы (Layers). */
  sign?: string;
}

const DESC_SIZE = 14;
const DESC_LINE_H = 21;
const DESC_MAX_LINES = 7;

const BELIEF_PAD_X = 16;
const BELIEF_PAD_Y = 14;
const BELIEF_SIZE = 15;
const BELIEF_LINE_H = 21;
const BELIEF_MAX_LINES = 4;
/** От базовой линии последней строки описания до плашки убеждения. */
const BELIEF_GAP = 4;

export function drawSchemaCard(canvas: HTMLCanvasElement, d: SchemaCardData) {
  const maxW = CARD_W - CARD_PAD * 2;
  const head: HeaderOpts = {
    eyebrow: d.domain,
    title: d.name,
    sign: d.sign ?? 'layers',
  };
  const headH = headerLines(canvas.getContext('2d')!, head).height;
  const descLines = measureClamp(
    canvas,
    d.desc,
    maxW,
    DESC_SIZE,
    DESC_MAX_LINES,
  );

  const beliefMaxW = maxW - BELIEF_PAD_X * 2;
  const beliefLines = d.belief
    ? measureClamp(
        canvas,
        `«${d.belief}»`,
        beliefMaxW,
        BELIEF_SIZE,
        BELIEF_MAX_LINES,
        undefined,
        SERIF,
      )
    : [];
  const beliefPanelH = beliefLines.length
    ? beliefLines.length * BELIEF_LINE_H + BELIEF_PAD_Y * 2
    : 0;

  const H =
    headH +
    descLines.length * DESC_LINE_H +
    (beliefLines.length ? BELIEF_GAP + beliefPanelH : 0) +
    16 +
    FOOTER_H;

  const c = beginCard(canvas, H, { accent: d.domainColor });
  const contentY = header(c, head);

  let y = drawWrapped(c, d.desc, CARD_PAD, contentY + 2, maxW, {
    size: DESC_SIZE,
    color: INK.text,
    lineH: DESC_LINE_H,
    maxLines: DESC_MAX_LINES,
  });

  if (beliefLines.length) {
    y += BELIEF_GAP - DESC_LINE_H + 10;
    panel(c, CARD_PAD, y, maxW, beliefPanelH);
    const { ctx } = c;
    ctx.font = `italic ${BELIEF_SIZE}px ${SERIF}`;
    ctx.fillStyle = INK.sub;
    ctx.textAlign = 'left';
    beliefLines.forEach((line, i) =>
      ctx.fillText(
        line,
        CARD_PAD + BELIEF_PAD_X,
        y + BELIEF_PAD_Y + 15 + i * BELIEF_LINE_H,
      ),
    );
  }

  footer(c, d.footerLabel ?? 'Схема-терапия');
}

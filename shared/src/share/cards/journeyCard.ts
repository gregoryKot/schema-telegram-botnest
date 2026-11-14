// Карточка «Мой путь» — лента последних шагов по времени (b23b): строка — знак сущности шага на
// бумажке её оттенка (journeyItemLook, тот же вид, что строка ленты в приложении), название и
// дата тихой подписью. Лист — небо «Моего пути» со знаком Sheets. Итог («N шагов») — в подписи.
// Строки готовит buildJourneyCardRows (чистая, тестируется без canvas).
import {
  CARD_PAD,
  FOOTER_H,
  INK,
  CARD_LOOK,
  beginCard,
  cardFont,
  footer,
  header,
  headerLines,
  wrapClamp,
} from '../cardKit';
import { slipSign } from '../kit/slipSign';
import { glueSpaces } from '../../utils/typo';
import {
  formatJourneyDay,
  journeyTypeMeta,
  type JourneyItem,
} from '../../journey/journeyMeta';
import { journeyItemLook } from '../../journey/journeyLook';
import { pluralEntries } from '../shareTexts';

// Больше строк карточка не вмещает — buildJourneyCardRows режет по нему.
export const JOURNEY_CARD_MAX_ROWS = 8;

export interface JourneyCardRow {
  label: string;
  day: string;
  /** Бумага и знак сущности шага; незнакомый тип — null (тихая бумажка без знака). */
  hue: number | null;
  sign: string | null;
  /** Вариант мотива по счёту (благодарность — `Pebbles filled`). */
  n?: number;
}

/** Готовые строки для карточки-ленты: вид шага — journeyItemLook. Чистая. */
export function buildJourneyCardRows(
  items: readonly JourneyItem[],
  max = JOURNEY_CARD_MAX_ROWS,
): JourneyCardRow[] {
  return items.slice(0, max).map((item) => {
    const look = journeyItemLook(item);
    return {
      label: journeyTypeMeta(item.type).label,
      day: formatJourneyDay(item.at),
      hue: look?.hue ?? null,
      sign: look?.sign ?? null,
      ...(look?.n !== undefined ? { n: look.n } : {}),
    };
  });
}

const ROW_H = 54;
const SLIP_W = 60;
const SLIP_H = 40;
const SIGN_W = 42;
const SIGN_BOX = 28;
const TEXT_X = CARD_PAD + SLIP_W + 16;

/** Высота карточки по высоте шапки (headerLines) — чистая формула (тестируется без canvas). */
export function journeyCardHeight(
  rows: readonly unknown[],
  headH: number,
): number {
  const bodyH = rows.length ? rows.length * ROW_H : 44;
  return headH + bodyH + 8 + FOOTER_H;
}

export function drawJourneyCard(
  canvas: HTMLCanvasElement,
  rows: JourneyCardRow[],
  total: number,
  title = 'Мой путь',
  subtitle?: string,
) {
  // Короткий предлог не висит в конце строки подписи («заботы о / себе»).
  const sub = glueSpaces(
    subtitle ??
      `${total} ${pluralEntries(total)} заботы о себе · последние шаги`,
  );
  const look = CARD_LOOK.journey;
  const head = { eyebrow: 'Мой путь', title, subtitle: sub, sign: look.sign };
  const lines = headerLines(canvas.getContext('2d')!, head);
  const H = journeyCardHeight(rows, lines.height);
  const c = beginCard(canvas, H, { hue: look.hue });
  const { ctx } = c;

  const top = header(c, head, lines);

  if (!rows.length) {
    ctx.font = cardFont(14);
    ctx.fillStyle = INK.sub;
    ctx.fillText('Пока нет ни одного шага', CARD_PAD, top + 18);
    footer(c, 'Мой путь');
    return;
  }

  const textW = c.W - CARD_PAD - TEXT_X;
  const measure = (s: string) => ctx.measureText(s).width;
  rows.forEach((row, i) => {
    const y = top + i * ROW_H;
    const look =
      row.hue !== null && row.sign
        ? { hue: row.hue, sign: row.sign, n: row.n }
        : null;
    slipSign(c, look, CARD_PAD, y, {
      w: SLIP_W,
      h: SLIP_H,
      signW: SIGN_W,
      signBox: SIGN_BOX,
    });
    ctx.textAlign = 'left';
    ctx.font = cardFont(15);
    ctx.fillStyle = INK.text;
    const [label] = wrapClamp(measure, row.label, textW, 1);
    ctx.fillText(label ?? '', TEXT_X, y + 17);
    ctx.font = cardFont(12);
    ctx.fillStyle = INK.sub;
    ctx.fillText(row.day, TEXT_X, y + 35);
  });

  footer(c, 'Мой путь');
}

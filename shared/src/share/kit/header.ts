// Шапка share-карточки на бумаге: эйбрау чернилами оттенка листа, заголовок Literata (до двух
// строк), подпись с переносом и многоточием, знак сущности справа. Высоту шапки карточка
// считает до beginCard (`headerLines(ctx, opts).height`) — тем же расчётом, что рисует header.
import { CARD_PAD, CARD_W, cardFont, serifFont } from './theme';
import { clampLines, wrapLines } from './text';
import { INK } from './ink';
import { SHEET } from './paperFrame';
import { canvasSign } from './signs';
import { sign, tracking, type Card } from './frame';

export interface HeaderOpts {
  /** Рубрика над заголовком — чернилами оттенка листа. */
  eyebrow?: string;
  title: string;
  /** Подпись под заголовком; переносится целиком (до subtitleLines строк, дальше «…»). */
  subtitle?: string;
  subtitleLines?: number;
  /** Знак сущности справа от заголовка (ключ ENTITY_LOOK). */
  sign?: string;
}

const TITLE_Y = 84;
const TITLE_LH = 31;
const SUB_GAP = 25;
const SUB_LH = 19;
const HEAD_GAP = 26;
/** Ширина знака в шапке и зазор до текста. */
export const HEADER_SIGN_W = 78;
const SIGN_GAP = 14;

/** Высота шапки от верха карточки — чистая (нужна для расчёта высоты). */
export function headerHeight(
  titleLines: number,
  subtitle?: boolean | number,
): number {
  const subLines = subtitle === true ? 1 : subtitle || 0;
  return (
    TITLE_Y +
    (titleLines - 1) * TITLE_LH +
    (subLines ? SUB_GAP + (subLines - 1) * SUB_LH : 0) +
    HEAD_GAP
  );
}

const textWidth = (c: { W: number }, o: HeaderOpts) =>
  c.W -
  CARD_PAD * 2 -
  (o.sign && canvasSign(o.sign) ? HEADER_SIGN_W + SIGN_GAP : 0);

/** Строки шапки под шрифт карточки: заголовок до 2 строк, подпись до subtitleLines. */
export function headerLines(ctx: CanvasRenderingContext2D, o: HeaderOpts) {
  const maxW = textWidth({ W: CARD_W }, o);
  const measure = (s: string) => ctx.measureText(s).width;
  ctx.font = serifFont(26);
  const title = clampLines(wrapLines(measure, o.title, maxW), 2);
  ctx.font = cardFont(13.5);
  const sub = o.subtitle
    ? clampLines(wrapLines(measure, o.subtitle, maxW), o.subtitleLines ?? 3)
    : [];
  return { title, sub, height: headerHeight(title.length, sub.length) };
}

/** Высота шапки до beginCard (канвас ещё без листа — меряем его контекстом). */
export function measureHeader(
  canvas: HTMLCanvasElement,
  o: HeaderOpts,
): number {
  return headerLines(canvas.getContext('2d')!, o).height;
}

/** Шапка: рубрика, заголовок Literata, подпись, знак справа. Возвращает Y начала содержимого. */
export function header(c: Card, o: HeaderOpts): number {
  const { ctx } = c;
  const { title, sub, height } = headerLines(ctx, o);
  ctx.textAlign = 'left';
  if (o.sign)
    sign(
      c,
      o.sign,
      c.W - CARD_PAD - HEADER_SIGN_W,
      SHEET.y + 26,
      HEADER_SIGN_W,
    );
  if (o.eyebrow) {
    ctx.font = cardFont(10.5, 'bold');
    ctx.fillStyle = c.accent;
    tracking(ctx, 1.1);
    const [eyebrow] = clampLines(
      wrapLines(
        (s) => ctx.measureText(s).width,
        o.eyebrow.toUpperCase(),
        textWidth(c, o),
      ),
      1,
    );
    ctx.fillText(eyebrow ?? '', CARD_PAD, 52);
    tracking(ctx, 0);
  }
  let y = TITLE_Y;
  ctx.font = serifFont(26);
  ctx.fillStyle = INK.text;
  for (const line of title) {
    ctx.fillText(line, CARD_PAD, y);
    y += TITLE_LH;
  }
  y += SUB_GAP - TITLE_LH;
  ctx.font = cardFont(13.5);
  ctx.fillStyle = INK.sub;
  for (const line of sub) {
    ctx.fillText(line, CARD_PAD, y);
    y += SUB_LH;
  }
  return height;
}

// Карточка одного шага «Моего пути» (b23b): лист сущности шага, её знак крупно по центру (вид —
// journeyItemLook, как шапка детали в приложении), название Literata, уточнение (потребность,
// режим, схема) и дата тихими подписями. Незнакомый тип — небо «Моего пути» без знака.
import {
  CARD_W,
  CARD_PAD,
  CARD_LOOK,
  FOOTER_H,
  INK,
  SERIF,
  beginCard,
  canvasSign,
  cardFont,
  footer,
  measureClamp,
  serifFont,
  sign,
  signHeight,
  tracking,
} from '../cardKit';

export interface JourneyItemCardData {
  label: string;
  /** Потребность/режим/схема — может отсутствовать */
  sub: string | null;
  day: string;
  /** Бумага и знак сущности шага (journeyItemLook); незнакомый тип — null. */
  hue: number | null;
  sign: string | null;
}

const EYEBROW_Y = 54;
const ART_TOP = 80;
const ART_BOX = 112;
const ART_W = 170;
const TITLE_LH = 34;
const SUB_LH = 20;

/** Высота карточки по числу строк названия и уточнения — чистая формула. */
export function journeyItemCardHeight(
  hasArt: boolean,
  titleLines: number,
  subLines: number,
): number {
  const titleY = ART_TOP + (hasArt ? ART_BOX : 0) + 50;
  const subEnd =
    titleY +
    (titleLines - 1) * TITLE_LH +
    subLines * SUB_LH +
    (subLines ? 6 : 0);
  return subEnd + 28 + 26 + FOOTER_H;
}

export function drawJourneyItemCard(
  canvas: HTMLCanvasElement,
  data: JourneyItemCardData,
) {
  const key = canvasSign(data.sign ?? undefined);
  const maxW = CARD_W - CARD_PAD * 2;
  const title = measureClamp(canvas, data.label, maxW, 28, 2, undefined, SERIF);
  const sub = data.sub ? measureClamp(canvas, data.sub, maxW, 14, 2) : [];
  const H = journeyItemCardHeight(Boolean(key), title.length, sub.length);
  const c = beginCard(canvas, H, { hue: data.hue ?? CARD_LOOK.journey.hue });
  const { ctx } = c;
  const cx = c.W / 2;

  ctx.textAlign = 'center';
  ctx.font = cardFont(10.5, 'bold');
  ctx.fillStyle = c.accent;
  tracking(ctx, 1.1);
  ctx.fillText('МОЙ ПУТЬ', cx, EYEBROW_Y);
  tracking(ctx, 0);

  if (key) {
    const h0 = signHeight(key, ART_W);
    const w = h0 > ART_BOX ? (ART_W * ART_BOX) / h0 : ART_W;
    const h = signHeight(key, w);
    sign(c, key, cx - w / 2, ART_TOP + (ART_BOX - h) / 2, w);
  }

  let y = ART_TOP + (key ? ART_BOX : 0) + 50;
  ctx.textAlign = 'center';
  ctx.font = serifFont(28);
  ctx.fillStyle = INK.text;
  title.forEach((line, i) => ctx.fillText(line, cx, y + i * TITLE_LH));
  y += (title.length - 1) * TITLE_LH;

  ctx.font = cardFont(14);
  ctx.fillStyle = INK.sub;
  sub.forEach((line, i) => {
    y += SUB_LH + (i === 0 ? 6 : 0);
    ctx.fillText(line, cx, y);
  });
  y += 28;
  ctx.font = cardFont(12.5);
  ctx.fillText(data.day, cx, y);

  ctx.textAlign = 'left';
  footer(c, 'Мой путь');
}

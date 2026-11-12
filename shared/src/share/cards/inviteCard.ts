// Карточка-приглашение (b23b) — лист своего вида (INVITE_LOOK): в приложение — знак продукта
// крупно на персике и пять полосок потребностей (мотив Strokes цветами данных); в пару — код
// «билетиком»: светлый билет с тенью-вырезкой, корешок со знаком привязанности за перфорацией;
// от терапевта — знак Talk крупно на небе. Приватных данных нет — только код; ссылка уходит
// текстом рядом с картинкой (по картинке не ткнуть).
import {
  CARD_W,
  CARD_PAD,
  FOOTER_H,
  INK,
  INVITE_LOOK,
  NEED_INK_ORDER,
  beginCard,
  cardFont,
  drawWrapped,
  footer,
  header,
  headerLines,
  measureClamp,
  needDataInk,
  paperSlip,
  sign,
  signHeight,
  tracking,
  type Card,
  type InviteKind,
} from '../cardKit';
import { drawBrandMark } from '../kit/brandMark';

export interface InviteCardData {
  /** Вид приглашения: лист и знак (INVITE_LOOK). */
  kind: InviteKind;
  /** «Приглашение в пару» / «Приглашение от терапевта» */
  title: string;
  /** Код, который вводит второй человек, — билетом. */
  code?: string;
  /** Подпись — что сделать (до 3 строк). */
  hint: string;
}

const HINT_LH = 20;
const HINT_MAX = 3;
const HERO_H: Record<InviteKind, number> = {
  app: 150,
  pair: 104,
  therapist: 104,
};
const TICKET_H = 96;
const STUB_W = 96;

/** Пять полосок потребностей цветами данных (мотив Strokes, как «Зачем это всё»). */
const NEED_FILLS = NEED_INK_ORDER.map((id) => needDataInk(id));

function drawAppHero(c: Card, y: number) {
  const mark = 128;
  const strokesW = 150;
  const gap = 22;
  const x0 = (c.W - mark - gap - strokesW) / 2;
  drawBrandMark(c.ctx, x0, y + 6, mark);
  const sh = signHeight('strokes', strokesW);
  sign(c, 'strokes', x0 + mark + gap, y + 6 + (mark - sh) / 2, strokesW, {
    fills: NEED_FILLS,
  });
}

/** Билет с кодом: светлая бумага, полукруглые вырезы кромки и перфорация перед корешком. */
function drawTicket(c: Card, code: string, y: number) {
  const { ctx } = c;
  const x = CARD_PAD;
  const w = c.W - CARD_PAD * 2;
  paperSlip(c, x, y, w, TICKET_H, c.hue, { r: 14, fill: INK.surface });
  const perfX = x + STUB_W;
  // Вырезы сверху и снизу у линии отрыва — бумагой листа, сплошным цветом.
  ctx.fillStyle = c.paper;
  for (const cy of [y, y + TICKET_H]) {
    ctx.beginPath();
    ctx.arc(perfX, cy, 9, 0, Math.PI * 2);
    ctx.fill();
  }
  // Перфорация — ряд точек тоном глубже листа.
  ctx.fillStyle = c.sunk;
  for (let py = y + 18; py <= y + TICKET_H - 16; py += 10) {
    ctx.beginPath();
    ctx.arc(perfX, py, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  const look = INVITE_LOOK.pair;
  const sw = 84;
  sign(
    c,
    look.sign,
    x + (STUB_W - sw) / 2,
    y + (TICKET_H - signHeight(look.sign, sw)) / 2,
    sw,
  );
  // Код — крупно по центру отрывной части; длинный — мельче, в поле билета.
  const areaX = perfX + 14;
  const areaW = x + w - areaX - 16;
  let size = 34;
  ctx.font = cardFont(size, 'bold');
  tracking(ctx, 2);
  while (size > 16 && ctx.measureText(code).width > areaW) {
    size -= 2;
    ctx.font = cardFont(size, 'bold');
  }
  ctx.fillStyle = INK.text;
  ctx.textAlign = 'center';
  ctx.fillText(code, areaX + areaW / 2, y + TICKET_H / 2 + size * 0.36);
  tracking(ctx, 0);
  ctx.textAlign = 'left';
}

/** Высота карточки: шапка (её высота), герой своего вида, подпись. Чистая. */
export function inviteCardHeight(
  kind: InviteKind,
  headH: number,
  hintLines: number,
): number {
  return headH + HERO_H[kind] + 22 + hintLines * HINT_LH + 8 + FOOTER_H;
}

export function drawInviteCard(canvas: HTMLCanvasElement, d: InviteCardData) {
  const look = INVITE_LOOK[d.kind];
  const head = { eyebrow: 'Приглашение', title: d.title };
  const lines = headerLines(canvas.getContext('2d')!, head);
  const hint = measureClamp(
    canvas,
    d.hint,
    CARD_W - CARD_PAD * 2,
    14,
    HINT_MAX,
  );
  const H = inviteCardHeight(d.kind, lines.height, hint.length);
  const c = beginCard(canvas, H, { hue: look.hue });
  const top = header(c, head, lines);

  if (d.kind === 'app') drawAppHero(c, top);
  else if (d.code) drawTicket(c, d.code, top);
  else {
    // Знак вида крупно (~160px): от терапевта — Talk на небе.
    const w = 160;
    const h = signHeight(look.sign, w);
    sign(c, look.sign, (c.W - w) / 2, top + (HERO_H[d.kind] - h) / 2, w);
  }

  const hintY = top + HERO_H[d.kind] + 36;
  drawWrapped(c, d.hint, CARD_PAD, hintY, CARD_W - CARD_PAD * 2, {
    size: 14,
    color: INK.sub,
    lineH: HINT_LH,
    maxLines: HINT_MAX,
  });
  footer(c, 'Приглашение');
}

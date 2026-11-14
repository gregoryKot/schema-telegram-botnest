// Рамка share-карточки на бумаге: лист оттенка сущности (paperFrame.ts), знак сущности, светлые
// плашки и подвал со знаком продукта; шапка — header.ts. Карточки только раскладывают
// содержимое между шапкой и подвалом, в полях [CARD_PAD, W − CARD_PAD].
import {
  CARD_PAD,
  CARD_W,
  DPR,
  cardFont,
  resolveCardTheme,
  type CardTheme,
} from './theme';
import { drawBrandMark } from './brandMark';
import { INK, inkAlpha, inkOf } from './ink';
import {
  SHEET,
  hueFromColor,
  hueInkHex,
  layerHex,
  paintSheet,
  paperHex,
  sunkHex,
} from './paperFrame';
import { canvasSign, drawSign, signHeight, type SignPaint } from './signs';

export interface Card {
  ctx: CanvasRenderingContext2D;
  W: number;
  H: number;
  th: CardTheme;
  /** Оттенок бумаги листа. */
  hue: number;
  /** Бумага листа и тон глубже (пустая клетка, паз) — значениями. */
  paper: string;
  sunk: string;
  /** Читаемые чернила оттенка: эйбрау, номера, крупные числа. */
  accent: string;
}

/** Высота подвала с полем листа — карточки закладывают её в расчёт высоты. */
export const FOOTER_H = 74;

export interface CardOpts {
  /** Оттенок бумаги (ENTITY_LOOK); без него — ближайший к accent. */
  hue?: number;
  /** Цвет сущности старых вызовов ('#hex' или 'var(--c-rose)') — по нему выбирается бумага. */
  accent?: string;
}

/** Межбуквенный интервал (в браузерах без поддержки — молча игнорируется). */
export function tracking(ctx: CanvasRenderingContext2D, px: number) {
  (ctx as unknown as { letterSpacing: string }).letterSpacing = `${px}px`;
}

/** Настраивает канвас (DPR), кладёт лист бумаги и возвращает контекст карточки. */
export function beginCard(
  canvas: HTMLCanvasElement,
  H: number,
  opts: CardOpts = {},
): Card {
  const W = CARD_W;
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const hue = opts.hue ?? hueFromColor(opts.accent);
  paintSheet(ctx, W, H, hue);
  return {
    ctx,
    W,
    H,
    th: resolveCardTheme(),
    hue,
    paper: paperHex(hue),
    sunk: sunkHex(hue),
    accent: hueInkHex(hue),
  };
}

/** Светлая плашка на листе (плитка, цитата): бумага светлее, без рамки и тени. */
export function panel(
  c: Card,
  x: number,
  y: number,
  w: number,
  h: number,
  radius = 14,
) {
  c.ctx.fillStyle = 'rgba(255, 253, 249, 0.62)';
  c.ctx.beginPath();
  c.ctx.roundRect(x, y, w, h, radius);
  c.ctx.fill();
}

/** Знак сущности на листе по ключу; ключа нет в canvas-таблице — ничего. Возвращает высоту. */
export function sign(
  c: Card,
  key: string,
  x: number,
  y: number,
  w: number,
  paint?: SignPaint,
): number {
  const k = canvasSign(key);
  if (!k) return 0;
  drawSign(c.ctx, k, x, y, w, paint);
  return signHeight(k, w);
}

/** Расстояние между оттенками по кругу, 0–180. */
export const hueGap = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

/**
 * Бумажка оттенка hue на листе — плитка значка, подложка знака строки, билет: бумага с
 * тенью-вырезкой (второй лист тоном глубже, сдвинут вправо-вниз), как .pp-paper сайта.
 * fill — своя бумага вместо бумаги оттенка (светлый билет); shadow: false — тихая бумага без
 * второго листа (неполученный значок). Бумажка оттенка самого листа (ближе 25°) иначе сливалась
 * бы с ним — она светлая (--surface) на втором листе своего оттенка.
 */
export function paperSlip(
  c: Card,
  x: number,
  y: number,
  w: number,
  h: number,
  hue: number,
  o: { r?: number; fill?: string; shadow?: boolean } = {},
) {
  const { ctx } = c;
  const r = o.r ?? 12;
  const d = Math.max(3, Math.round(Math.min(w, h) * 0.06));
  if (o.shadow !== false) {
    ctx.fillStyle = layerHex(hue);
    ctx.beginPath();
    ctx.roundRect(x + d, y + d, w, h, r);
    ctx.fill();
  }
  ctx.fillStyle =
    o.fill ?? (hueGap(hue, c.hue) < 25 ? INK.surface : paperHex(hue));
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

export function divider(c: Card, y: number, alpha = 0.12) {
  c.ctx.strokeStyle = inkAlpha(alpha);
  c.ctx.lineWidth = 1;
  c.ctx.beginPath();
  c.ctx.moveTo(CARD_PAD, y);
  c.ctx.lineTo(c.W - CARD_PAD, y);
  c.ctx.stroke();
}

/** Мелкая подпись-рубрика над блоком («ОЦЕНКИ ДНЯ»). Возвращает Y под ней. */
export function sectionLabel(
  c: Card,
  text: string,
  y: number,
  color?: string,
): number {
  const { ctx } = c;
  ctx.font = cardFont(10.5, 'bold');
  ctx.fillStyle = color ? inkOf(color) : INK.sub;
  ctx.textAlign = 'left';
  tracking(ctx, 0.9);
  ctx.fillText(text.toUpperCase(), CARD_PAD, y);
  tracking(ctx, 0);
  return y + 18;
}

// Канал проекта — брендовая подпись карточек (захардкожен по всему проекту).
// Бот-ссылка в текст шаринга идёт отдельно через botShortUrl каждого фронта.
const BRAND = '@SchemeHappens';

export interface FooterOpts {
  /** Своя брендовая строка слева: без знака продукта. */
  brand?: string;
}

/** Подвал: знак продукта и @SchemeHappens слева, подпись карточки справа. */
export function footer(c: Card, label: string, o: FooterOpts = {}) {
  const { ctx } = c;
  const y = c.H - SHEET.y - SHEET.dy - 26;
  ctx.textAlign = 'left';
  if (o.brand) {
    ctx.font = cardFont(12);
    ctx.fillStyle = INK.sub;
    ctx.fillText(o.brand, CARD_PAD, y);
  } else {
    drawBrandMark(ctx, CARD_PAD, y - 16, 22, true);
    ctx.font = cardFont(12, 'bold');
    ctx.fillStyle = INK.sub;
    ctx.fillText(BRAND, CARD_PAD + 30, y);
  }
  if (label) {
    ctx.font = cardFont(11.5);
    ctx.fillStyle = INK.sub;
    ctx.textAlign = 'right';
    ctx.fillText(label, c.W - CARD_PAD, y);
  }
  ctx.textAlign = 'left';
}

/**
 * Высоты панелей-строк и суммарная высота столбика: каждая панель — обёрнутый
 * текст плюс вертикальные отступы, между панелями зазор. Один расчёт для всех
 * карточек-списков (благодарность, шаги практики).
 */
export function panelStack(
  lineCounts: number[],
  opts: { lineH: number; pad: number; gap: number },
): { heights: number[]; total: number } {
  const heights = lineCounts.map((n) => n * opts.lineH + opts.pad * 2);
  const total =
    heights.reduce((s, h) => s + h, 0) +
    opts.gap * Math.max(0, heights.length - 1);
  return { heights, total };
}

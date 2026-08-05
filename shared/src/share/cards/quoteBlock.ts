// Блок «подпись + панель с цитатой» — общий примитив карточек разбора фразы
// (краткой и полной). Обе рисуют одинаковые панели «Было»/«Стало», и до
// выноса это был буквальный дубль (правило №11: повторяешь блок — выноси).
import {
  CARD_W,
  CARD_PAD,
  panel,
  sectionLabel,
  measureWrap,
  clampLines,
  cardFont,
  type Card,
} from '../cardKit';

export const QUOTE_LINE_H = 20;
export const QUOTE_PAD_IN = 14;
export const QUOTE_LABEL_BLOCK = 22;

/** Цвета голосов — одинаковые на обеих карточках. */
export const VOICE_CRITIC = '#f2777a';
export const VOICE_CARE = '#7ad19b';

/** Реплика в кавычках, перенесённая по ширине панели и обрезанная по лимиту. */
export function quoteLines(
  canvas: HTMLCanvasElement,
  text: string,
  size: number,
  maxLines: number,
): string[] {
  const textW = CARD_W - CARD_PAD * 2 - QUOTE_PAD_IN * 2;
  return clampLines(measureWrap(canvas, `«${text}»`, textW, size), maxLines);
}

/** Высота панели под уже перенесённые строки (нужна для расчёта карточки). */
export function quoteBlockHeight(
  lines: string[],
  lineH = QUOTE_LINE_H,
): number {
  return QUOTE_PAD_IN * 2 + lines.length * lineH;
}

export interface QuoteBlockOpts {
  label: string;
  lines: string[];
  color: string;
  size: number;
  lineH?: number;
  /** Отступ под блоком до следующего */
  gap: number;
}

/** Рисует блок и возвращает новый y. */
export function drawQuoteBlock(c: Card, y: number, o: QuoteBlockOpts): number {
  const lineH = o.lineH ?? QUOTE_LINE_H;
  const { ctx, th } = c;
  const panelW = c.W - CARD_PAD * 2;
  let top = sectionLabel(c, o.label, y + 4, o.color);
  const h = quoteBlockHeight(o.lines, lineH);
  panel(c, CARD_PAD, top, panelW, h, 16);

  ctx.font = cardFont(o.size);
  ctx.fillStyle = th.fg(0.85);
  ctx.textAlign = 'left';
  let ty = top + QUOTE_PAD_IN + 11;
  for (const line of o.lines) {
    ctx.fillText(line, CARD_PAD + QUOTE_PAD_IN, ty);
    ty += lineH;
  }
  top += h + o.gap;
  return top;
}

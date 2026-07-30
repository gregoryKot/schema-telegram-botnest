// Текст на канвасе: перенос по словам, обрезка с многоточием, отрисовка
// абзаца. Чистая часть (wrapLines/clampLines) покрыта тестами — canvas в
// jsdom не реализован, поэтому измерение приходит функцией снаружи.
import { cardFont } from './theme';
import type { Card } from './frame';

/** Чистый перенос по словам. measure — ширина строки в px при нужном шрифте. */
export function wrapLines(
  measure: (s: string) => number,
  text: string,
  maxW: number,
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let line = words[0];
  for (const word of words.slice(1)) {
    if (measure(`${line} ${word}`) <= maxW) line += ` ${word}`;
    else {
      lines.push(line);
      line = word;
    }
  }
  lines.push(line);
  return lines;
}

/** Обрезает список строк до maxLines, добавляя многоточие к последней. */
export function clampLines(lines: string[], maxLines: number): string[] {
  if (lines.length <= maxLines) return lines;
  const cut = lines.slice(0, maxLines);
  cut[maxLines - 1] = cut[maxLines - 1].replace(/[,.;:]?$/, '…');
  return cut;
}

/** Меряет текст под шрифт — для расчёта числа строк ДО beginCard. */
export function measureWrap(
  canvas: HTMLCanvasElement,
  text: string,
  maxW: number,
  size: number,
  weight?: 'bold',
): string[] {
  const ctx = canvas.getContext('2d')!;
  ctx.font = cardFont(size, weight);
  return wrapLines((s) => ctx.measureText(s).width, text, maxW);
}

export interface WrapOpts {
  size: number;
  color: string;
  lineH: number;
  maxLines?: number;
  align?: CanvasTextAlign;
  weight?: 'bold';
  italic?: boolean;
}

/** Рисует обёрнутый текст, возвращает Y после последней строки. */
export function drawWrapped(
  c: Card,
  text: string,
  x: number,
  y: number,
  maxW: number,
  opts: WrapOpts,
): number {
  const base = cardFont(opts.size, opts.weight);
  c.ctx.font = opts.italic ? `italic ${base}` : base;
  c.ctx.fillStyle = opts.color;
  c.ctx.textAlign = opts.align ?? 'left';
  let lines = wrapLines((s) => c.ctx.measureText(s).width, text, maxW);
  if (opts.maxLines) lines = clampLines(lines, opts.maxLines);
  for (const line of lines) {
    c.ctx.fillText(line, x, y);
    y += opts.lineH;
  }
  c.ctx.textAlign = 'left';
  return y;
}

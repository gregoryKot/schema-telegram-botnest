// Текст на канвасе: перенос, обрезка с многоточием, абзац; wrapLines/clampLines — чистые.
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
export function clampLines(
  lines: string[],
  maxLines: number,
  fit?: { measure: (s: string) => number; maxW: number },
): string[] {
  if (lines.length <= maxLines) return lines;
  const cut = lines.slice(0, maxLines);
  let last = cut[maxLines - 1].replace(/[,.;:…]?$/, '…');
  // С мерой: многоточие не выносит строку за поле — снимаем слова с конца.
  while (fit && fit.measure(last) > fit.maxW && last.includes(' ')) {
    last = `${last.slice(0, last.lastIndexOf(' ')).replace(/[,.;:—–-]?\s*$/, '')}…`;
  }
  cut[maxLines - 1] = last;
  return cut;
}

/** Перенос с обрезкой по строкам: многоточие остаётся в поле maxW. */
export function wrapClamp(
  measure: (s: string) => number,
  text: string,
  maxW: number,
  maxLines: number,
): string[] {
  return clampLines(wrapLines(measure, text, maxW), maxLines, {
    measure,
    maxW,
  });
}

/** Меряет текст под шрифт — для расчёта числа строк ДО beginCard. */
export function measureWrap(
  canvas: HTMLCanvasElement,
  text: string,
  maxW: number,
  size: number,
  weight?: 'bold',
  family?: string,
): string[] {
  const ctx = canvas.getContext('2d')!;
  ctx.font = cardFont(size, weight, family);
  return wrapLines((s) => ctx.measureText(s).width, text, maxW);
}

/** measureWrap с обрезкой: не больше maxLines строк, многоточие — в поле maxW. */
export function measureClamp(
  canvas: HTMLCanvasElement,
  text: string,
  maxW: number,
  size: number,
  maxLines: number,
  weight?: 'bold',
  family?: string,
): string[] {
  const ctx = canvas.getContext('2d')!;
  ctx.font = cardFont(size, weight, family);
  return wrapClamp((s) => ctx.measureText(s).width, text, maxW, maxLines);
}

export interface WrapOpts {
  size: number;
  color: string;
  lineH: number;
  maxLines?: number;
  align?: CanvasTextAlign;
  weight?: 'bold';
  italic?: boolean;
  family?: string;
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
  const { size, weight, family, italic } = opts;
  c.ctx.font = `${italic ? 'italic ' : ''}${cardFont(size, weight, family)}`;
  c.ctx.fillStyle = opts.color;
  c.ctx.textAlign = opts.align ?? 'left';
  let lines = wrapLines((s) => c.ctx.measureText(s).width, text, maxW);
  if (opts.maxLines)
    lines = clampLines(lines, opts.maxLines, {
      measure: (s) => c.ctx.measureText(s).width,
      maxW,
    });
  for (const line of lines) {
    c.ctx.fillText(line, x, y);
    y += opts.lineH;
  }
  c.ctx.textAlign = 'left';
  return y;
}

// Оценка высоты фигуры по тексту. Раскладка — чистая функция без DOM, поэтому
// строки считаются по средней ширине буквы с запасом: лишняя строка запаса
// безопаснее текста, вылезшего за контур. Обрезка многоточием (line-clamp) в
// DiagramNodeText работает по тем же лимитам строк.
import type { DiagramNode, DiagramShape } from './diagramTypes';

export const FONT = { title: 13, sub: 11, body: 12, caption: 11 } as const;
export const LINE = { title: 17, sub: 14, body: 16, caption: 14 } as const;
/** Средняя ширина буквы в долях кегля: жирный заголовок шире обычного текста. */
const EM = { title: 0.62, body: 0.58 } as const;
const TITLE_MAX_LINES = 2;
const CAPTION_MAX_LINES = 2;
const BODY_GAP = 4;
const V_PAD = 6;

/** Доля ширины и высоты фигуры, в которую вписывается текст (внутри контура). */
export const FIT: Record<DiagramShape, { kx: number; ky: number }> = {
  ellipse: { kx: 0.74, ky: 0.66 },
  octagon: { kx: 0.78, ky: 0.7 },
  pentagon: { kx: 0.72, ky: 0.62 },
  shield: { kx: 0.84, ky: 0.66 },
  pill: { kx: 0.86, ky: 0.8 },
  rounded: { kx: 0.9, ky: 0.84 },
};

/** Слово в начале строки: сколько строк оно добавляет и сколько букв останется в последней. */
function startLine(
  word: number,
  perLine: number,
): [extra: number, len: number] {
  const extra = Math.max(0, Math.ceil(word / perLine) - 1);
  return [extra, word <= perLine ? word : word % perLine || perLine];
}

/** Сколько строк займёт текст при данной ширине строки в буквах; абзацы считаются отдельно. */
export function wrapLines(text: string, perLine: number): number {
  const width = Math.max(1, perLine);
  let lines = 0;
  for (const para of text.split('\n')) {
    let len = 0;
    let n = 1;
    for (const word of para.split(/\s+/).filter(Boolean)) {
      if (len > 0 && len + 1 + word.length <= width) {
        len += 1 + word.length;
        continue;
      }
      const [extra, rest] = startLine(word.length, width);
      n += (len > 0 ? 1 : 0) + extra;
      len = rest;
    }
    lines += n;
  }
  return lines;
}

const perLine = (px: number, size: number, em: number) =>
  Math.max(1, Math.floor(px / (size * em)));

/** Ширина текстовой области фигуры в пикселях. */
export const textWidth = (shape: DiagramShape, w: number) =>
  Math.floor(FIT[shape].kx * w);

export interface Measured {
  titleLines: number;
  captionLines: number;
  bodyLines: number;
  h: number;
}

/**
 * Высота фигуры под её текст: заголовок до двух строк, мелкая строка, подпись
 * и текст до `bodyMax` строк. `minH` — нижняя граница, чтобы пустая фигура не
 * схлопывалась в полоску.
 */
export function measureNode(
  n: Pick<DiagramNode, 'shape' | 'label' | 'sublabel' | 'caption' | 'body'>,
  w: number,
  bodyMax: number,
  minH: number,
): Measured {
  const tw = textWidth(n.shape, w) - 8;
  const titleLines = Math.min(
    TITLE_MAX_LINES,
    wrapLines(n.label, perLine(tw, FONT.title, EM.title)),
  );
  const captionLines = n.caption
    ? Math.min(
        CAPTION_MAX_LINES,
        wrapLines(n.caption, perLine(tw, FONT.caption, EM.body)),
      )
    : 0;
  const bodyLines = n.body
    ? Math.min(bodyMax, wrapLines(n.body, perLine(tw, FONT.body, EM.body)))
    : 0;
  const content =
    (n.label ? titleLines * LINE.title : 0) +
    (n.sublabel ? LINE.sub : 0) +
    captionLines * LINE.caption +
    (bodyLines ? bodyLines * LINE.body + BODY_GAP : 0);
  const h = Math.max(minH, Math.ceil(content / FIT[n.shape].ky) + 2 * V_PAD);
  return { titleLines, captionLines, bodyLines, h };
}

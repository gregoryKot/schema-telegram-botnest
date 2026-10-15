import { SPACE } from './diagramTypes';

export interface FlowItem {
  w: number;
  h: number;
  /** Зазор перед фигурой в одном ряду, если он не обычный. */
  gapBefore?: number;
}

export interface FlowResult {
  /** Координаты по порядку входа; y — от верха блока. */
  placed: { x: number; y: number }[];
  /** Ширина самого широкого ряда. */
  w: number;
  h: number;
}

/**
 * Укладывает фигуры рядами: ряд переносится, когда не влезает в avail (или
 * набрал maxPerRow фигур). Ряды центрируются в [x0, x0 + avail], фигуры в
 * ряду — по вертикали относительно самой высокой.
 */
export function flowRows(
  items: FlowItem[],
  x0: number,
  avail: number,
  maxPerRow = Infinity,
): FlowResult {
  const rows: { idx: number[]; w: number; h: number }[] = [];
  items.forEach((it, i) => {
    const row = rows[rows.length - 1];
    const gap = it.gapBefore ?? SPACE.gap;
    if (row && row.idx.length < maxPerRow && row.w + gap + it.w <= avail) {
      row.idx.push(i);
      row.w += gap + it.w;
      row.h = Math.max(row.h, it.h);
    } else {
      rows.push({ idx: [i], w: it.w, h: it.h });
    }
  });

  const placed: FlowResult['placed'] = [];
  let y = 0;
  for (const row of rows) {
    let x = x0 + (avail - row.w) / 2;
    row.idx.forEach((i, k) => {
      if (k > 0) x += items[i].gapBefore ?? SPACE.gap;
      placed[i] = { x, y: y + (row.h - items[i].h) / 2 };
      x += items[i].w;
    });
    y += row.h + SPACE.gap;
  }
  return {
    placed,
    w: rows.reduce((m, r) => Math.max(m, r.w), 0),
    h: rows.length === 0 ? 0 : y - SPACE.gap,
  };
}

/**
 * Ширина колонки фигуры. Пока в ряд влезают две полной ширины, берётся она;
 * на телефоне фигура сужается до половины ряда (но не уже min), чтобы две
 * стояли рядом, а не столбиком. Не влезает и так — одна, не шире avail.
 */
export function fitWidth(base: number, min: number, avail: number): number {
  if (2 * base + SPACE.gap <= avail) return base;
  const half = Math.floor((avail - SPACE.gap) / 2);
  return half >= min ? half : Math.min(base, avail);
}

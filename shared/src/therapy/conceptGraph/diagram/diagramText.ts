import type { CSSProperties } from 'react';
import type { DiagramNode, DiagramShape } from './diagramTypes';

/** Поля текста внутри фигуры: сверху, справа, снизу, слева — чтобы строки не лезли на косые края. */
const INSET: Record<DiagramShape, [number, number, number, number]> = {
  ellipse: [6, 22, 6, 22],
  octagon: [6, 18, 6, 18],
  pentagon: [16, 18, 8, 18],
  shield: [8, 22, 20, 22],
  pill: [4, 22, 4, 22],
  rounded: [6, 14, 6, 14],
  cloud: [16, 26, 14, 26],
  tag: [6, 52, 6, 14],
};
const SMALL_PILL: [number, number, number, number] = [2, 12, 2, 12];

const px = (v: number[]) => v.map((n) => `${n}px`).join(' ');

/** Поля фигуры: схема и потребность — узкие таблетки, у них свои. */
export function textInset(n: DiagramNode): string {
  const small = n.kind === 'schema' || n.kind === 'need';
  return px(small ? SMALL_PILL : INSET[n.shape]);
}

export function clampLines(lines: number): CSSProperties {
  return {
    display: '-webkit-box',
    WebkitLineClamp: lines,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    overflowWrap: 'break-word',
  };
}

/** Сколько строк подписи вмещает фигура. */
export function sublabelLines(n: DiagramNode): number {
  if (n.kind === 'trigger') return 2;
  if (n.kind === 'mode') return 1;
  return 3;
}

/** Текст обычных фигур стоит по центру, поля концептуализации — слева (облако триггера по центру). */
export const isTextNode = (n: DiagramNode) =>
  n.kind === 'experience' ||
  n.kind === 'goals' ||
  n.kind === 'problems' ||
  n.kind === 'trigger';
export const isLeftAligned = (n: DiagramNode) =>
  isTextNode(n) && n.kind !== 'trigger';

const WORD_W = 7.6;

/** Кегль названия: длинное слово («Гиперконтролёр») на узком контуре сжимается, а не рвётся посреди слова. */
export function labelSize(n: DiagramNode): number {
  if (isTextNode(n)) return 11;
  if (n.kind === 'placeholder') return 12;
  const [, right, , left] = INSET[n.shape];
  const usable = n.w - (n.kind === 'mode' ? right + left : 0);
  const longest = Math.max(...n.label.split(/[\s/]+/).map((w) => w.length));
  return n.kind === 'mode' && longest * WORD_W > usable ? 12 : 13;
}

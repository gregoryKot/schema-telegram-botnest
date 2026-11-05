// Пять потребностей — один язык знаков (docs/design/PAPER_2026-11.md, «Язык
// знаков»): полоска бумаги — живая сила потребности, та же, что в пяти
// полосках трекера. Привязанность — две полоски склонились друг к другу;
// автономия — одна стоит прямо, сама; выражение — из полоски выходит волна,
// голос; спонтанность — полоска подпрыгнула дугой; границы — полоска внутри
// своей рамки. Цвета только из палитры бумаги (paper.ts).
import type { ReactElement } from 'react';
import type { NeedId } from '../../../../shared/src/needs/types';
import { PAPER, type ArtProps } from './paper';
import { PaperSvg as Svg } from './PaperSvg';

const STROKE = { width: 16, rx: 8 } as const;
/** Полоска: x — левый край, высота h, наклон deg вокруг нижней точки. */
function Stroke({ x, h, deg = 0, fill, y }: { x: number; h: number; deg?: number; fill: string; y?: number }) {
  const top = y ?? 60 - h;
  return <rect x={x} y={top} width={STROKE.width} height={h} rx={STROKE.rx} fill={fill} transform={`rotate(${deg} ${x + 8} 60)`} />;
}

function Attachment({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <Stroke x={40} h={50} deg={14} fill={PAPER.sage} />
      <Stroke x={64} h={50} deg={-14} fill={PAPER.clay} />
    </Svg>
  );
}
function Autonomy({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <path d="M16 60 H104" stroke={PAPER.sage} strokeWidth="4" strokeLinecap="round" />
      <Stroke x={52} h={54} fill={PAPER.moss} />
    </Svg>
  );
}
function Expression({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <Stroke x={24} h={50} fill={PAPER.moss} />
      <path d="M46 20 C 58 8, 68 32, 80 20 S 102 8, 110 20" fill="none" stroke={PAPER.clay} strokeWidth="9" strokeLinecap="round" />
    </Svg>
  );
}
function Play({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <path d="M22 58 C 30 10, 90 10, 98 58" fill="none" stroke={PAPER.amber} strokeWidth="16" strokeLinecap="round" />
      <circle cx="60" cy="14" r="5" fill={PAPER.clay} />
    </Svg>
  );
}
function Limits({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <rect x="26" y="4" width="68" height="56" rx="14" fill="none" stroke={PAPER.moss} strokeWidth="8" />
      <Stroke x={52} h={36} fill={PAPER.clay} y={14} />
    </Svg>
  );
}

const BY_NEED: Record<NeedId, (p: ArtProps) => ReactElement> = {
  attachment: Attachment, autonomy: Autonomy, expression: Expression, play: Play, limits: Limits,
};

/** Мотив потребности по id; неизвестный id — ничего (без выдуманной картинки). */
export function NeedArt({ id, size }: ArtProps & { id: string }) {
  const Art = BY_NEED[id as NeedId];
  return Art ? <Art size={size} /> : null;
}

// Пять потребностей — по мотиву на каждую (docs/design/PAPER_2026-11.md):
// привязанность — два круга внахлёст; автономия — одна полоска стоит сама;
// выражение — волна и три точки, голос; спонтанность — спираль; границы —
// рамка с перекладиной. Цвета только из палитры бумаги (paper.ts).
import type { ReactElement } from 'react';
import type { NeedId } from '../../../../shared/src/needs/types';
import { PAPER, type ArtProps } from './paper';
import { PaperSvg as Svg } from './PaperSvg';

function Attachment({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <circle cx="46" cy="32" r="22" fill={PAPER.sage} />
      <circle cx="74" cy="32" r="22" fill={PAPER.clay} fillOpacity=".9" />
    </Svg>
  );
}
function Autonomy({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <rect x="52" y="10" width="16" height="48" rx="8" fill={PAPER.moss} />
      <circle cx="60" cy="8" r="5" fill={PAPER.clay} />
      <rect x="22" y="40" width="10" height="18" rx="5" fill={PAPER.sage} />
      <rect x="88" y="44" width="10" height="14" rx="5" fill={PAPER.sage} />
    </Svg>
  );
}
function Expression({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <path d="M10 44 C 26 20, 42 68, 58 44 S 90 20, 106 44" fill="none" stroke={PAPER.clay} strokeWidth="11" strokeLinecap="round" />
      <circle cx="84" cy="16" r="5" fill={PAPER.moss} />
      <circle cx="98" cy="10" r="4" fill={PAPER.sage} />
      <circle cx="110" cy="18" r="3" fill={PAPER.brown} />
    </Svg>
  );
}
function Play({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <path d="M60 32 m-2 0 a2 2 0 1 0 4 0 a8 8 0 1 1 -16 0 a14 14 0 1 0 28 0 a20 20 0 1 1 -40 0 a26 26 0 1 0 52 0" fill="none" stroke={PAPER.amber} strokeWidth="9" strokeLinecap="round" />
    </Svg>
  );
}
function Limits({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <rect x="18" y="8" width="84" height="48" rx="12" fill="none" stroke={PAPER.moss} strokeWidth="9" />
      <rect x="40" y="27" width="40" height="10" rx="5" fill={PAPER.clay} />
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

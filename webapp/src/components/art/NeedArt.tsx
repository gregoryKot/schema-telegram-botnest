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
      <path d="M62.0 32.0 L62.2 32.6 L62.2 33.3 L61.9 34.0 L61.3 34.6 L60.5 35.1 L59.4 35.4 L58.2 35.3 L57.1 34.9 L56.0 34.2 L55.2 33.2 L54.7 31.9 L54.7 30.4 L55.2 29.0 L56.1 27.7 L57.5 26.6 L59.3 25.9 L61.3 25.7 L63.3 26.1 L65.3 27.0 L66.9 28.4 L68.0 30.3 L68.5 32.4 L68.3 34.7 L67.4 36.8 L65.8 38.7 L63.5 40.2 L60.8 41.0 L57.8 41.1 L54.9 40.4 L52.3 39.0 L50.1 36.8 L48.7 34.2 L48.2 31.2 L48.7 28.1 L50.1 25.2 L52.5 22.7 L55.7 21.0 L59.3 20.0 L63.2 20.1 L67.0 21.2 L70.3 23.2 L72.9 26.1 L74.6 29.6 L75.0 33.4 L74.2 37.3 L72.2 40.9 L69.1 43.9 L65.0 46.0 L60.4 46.9 L55.6 46.7 L51.0 45.2 L47.0 42.5 L43.9 38.9 L42.1 34.5 L41.8 29.8 L42.9 25.2 L45.6 20.9 L49.5 17.4 L54.4 15.1 L60.0 14.1" fill="none" stroke={PAPER.amber} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
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

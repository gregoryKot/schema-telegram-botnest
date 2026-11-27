// Знак техники «Справочника» из книги о схема-терапии пар. Какой знак у какой техники — techniqueSigns.ts.
import { PAPER, type ArtProps } from './paper';
import { PaperSvg as Svg } from './PaperSvg';

const ROUND = { fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

/** Потребность и желание: в центре сплошной круг-потребность, вокруг пунктирные кружки-желания. */
export function NeedWish({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <circle cx="60" cy="32" r="12" fill={PAPER.moss} />
      <circle cx="22" cy="20" r="7" {...ROUND} stroke={PAPER.amber} strokeWidth="3" strokeDasharray="3 4" />
      <circle cx="98" cy="22" r="7" {...ROUND} stroke={PAPER.clay} strokeWidth="3" strokeDasharray="3 4" />
      <circle cx="30" cy="50" r="6" {...ROUND} stroke={PAPER.plum} strokeWidth="3" strokeDasharray="3 4" />
      <circle cx="92" cy="50" r="6" {...ROUND} stroke={PAPER.sage} strokeWidth="3" strokeDasharray="3 4" />
    </Svg>
  );
}

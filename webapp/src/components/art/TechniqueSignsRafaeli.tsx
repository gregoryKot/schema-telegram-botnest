// Знаки техник «Справочника» из книги Рафаэли, Бернштейн и Янга. Круг — человек, линия — связь,
// пунктир — то, что ещё не срослось. Какой знак у какой техники — techniqueSigns.ts.
import { PAPER, type ArtProps } from './paper';
import { PaperSvg as Svg } from './PaperSvg';

const ROUND = { fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

/** Ремонт разрыва: двое, линия между ними оборвана, сверху дуга-«мостик» её чинит. */
export function RuptureMend({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <circle cx="24" cy="40" r="10" fill={PAPER.clay} />
      <circle cx="96" cy="40" r="10" fill={PAPER.moss} />
      <path d="M38 40 H52 M68 40 H82" {...ROUND} stroke={PAPER.sage} strokeWidth="3" />
      <path d="M48 24 Q60 10 72 24" {...ROUND} stroke={PAPER.amber} strokeWidth="3" strokeDasharray="4 5" />
    </Svg>
  );
}

/** Обзор жизни: линия времени с тремя метками этапов, над ней точки «за», под ней точки «против». */
export function LifeColumns({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <path d="M12 32 H108" {...ROUND} stroke={PAPER.sage} strokeWidth="3" />
      <path d="M30 26 V38 M60 26 V38 M90 26 V38" {...ROUND} stroke={PAPER.sage} strokeWidth="3" />
      <circle cx="30" cy="16" r="5" fill={PAPER.plum} />
      <circle cx="60" cy="12" r="4" fill={PAPER.plum} />
      <circle cx="30" cy="50" r="6" fill={PAPER.moss} />
      <circle cx="60" cy="52" r="6" fill={PAPER.moss} />
      <circle cx="90" cy="48" r="6" fill={PAPER.moss} />
    </Svg>
  );
}

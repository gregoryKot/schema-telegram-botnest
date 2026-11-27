// Знак «сферы эмоционального резонанса» (Рёдигер, гл. 10): один стул, вокруг расходятся круги — реакция, которую
// наблюдают и не гасят. Какой знак у какой техники — techniqueSigns.ts.
import { PAPER, type ArtProps } from './paper';
import { PaperSvg as Svg } from './PaperSvg';

const ROUND = {
  fill: 'none',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

/** Сфера эмоционального резонанса: человек на одном стуле, вокруг него круги, дальше — пунктир наблюдателя. */
export function ResonanceSphere({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <circle
        cx="60"
        cy="30"
        r="14"
        {...ROUND}
        stroke={PAPER.clay}
        strokeWidth="3"
      />
      <circle
        cx="60"
        cy="30"
        r="26"
        {...ROUND}
        stroke={PAPER.amber}
        strokeWidth="3"
        strokeDasharray="4 5"
      />
      <circle cx="60" cy="26" r="6" fill={PAPER.plum} />
      <path
        d="M50 54 H70 M53 54 V40 H67 V54"
        {...ROUND}
        stroke={PAPER.sage}
        strokeWidth="3"
      />
    </Svg>
  );
}

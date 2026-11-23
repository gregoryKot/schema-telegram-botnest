// Знаки техник «Справочника» из книги Фаррелл, Рейсс и Шоу (docs/design/PAPER_2026-11.md,
// таблица техник). Какой знак у какой техники — techniqueSigns.ts.
import { PAPER, type ArtProps } from './paper';
import { PaperSvg as Svg } from './PaperSvg';

const ROUND = { fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const BOX = '0 0 120 64';
const LINES = 'M22 30 H34 M22 40 H30 M54 34 H66 M54 44 H62 M86 30 H98 M86 40 H94';

/** План управления режимами: три карточки на одном шнурке, по одной на режим; на каждой две строки. */
export function ModePlan({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox={BOX}>
      <path d="M10 10 Q60 22 110 10" {...ROUND} stroke={PAPER.sage} strokeWidth="4" />
      <rect x="16" y="18" width="24" height="34" rx="4" fill={PAPER.moss} />
      <rect x="48" y="22" width="24" height="34" rx="4" fill={PAPER.slate} />
      <rect x="80" y="18" width="24" height="34" rx="4" fill={PAPER.plum} />
      <path d={LINES} {...ROUND} stroke={PAPER.clay} strokeWidth="3" />
    </Svg>
  );
}

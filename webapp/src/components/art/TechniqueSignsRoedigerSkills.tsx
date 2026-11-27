// Знаки техник гл. 11 книги Рёдигера, Стивенс и Брокмана: лесенка навыков и колонки дневника.
import { PAPER, type ArtProps } from './paper';
import { PaperSvg as Svg } from './PaperSvg';

const ROUND = {
  fill: 'none',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

/** Иерархия навыков: ступени от лёгкой к сложной, на каждой — отметка напряжения. */
export function SkillLadder({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <path
        d="M14 56 H40 V42 H64 V28 H88 V14 H108"
        {...ROUND}
        stroke={PAPER.sage}
        strokeWidth="3"
      />
      <circle cx="27" cy="46" r="4" fill={PAPER.clay} />
      <circle cx="52" cy="32" r="4" fill={PAPER.amber} />
      <circle cx="76" cy="18" r="4" fill={PAPER.moss} />
    </Svg>
  );
}

/** Дневник: четыре колонки с записями разной длины. */
export function DiaryColumns({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <rect
        x="12"
        y="8"
        width="96"
        height="48"
        rx="4"
        {...ROUND}
        stroke={PAPER.brown}
        strokeWidth="3"
      />
      <path
        d="M36 8 V56 M60 8 V56 M84 8 V56"
        {...ROUND}
        stroke={PAPER.sage}
        strokeWidth="2"
      />
      <path d="M24 20 V34" {...ROUND} stroke={PAPER.clay} strokeWidth="3" />
      <path d="M48 20 V42" {...ROUND} stroke={PAPER.amber} strokeWidth="3" />
      <path d="M72 20 V28" {...ROUND} stroke={PAPER.plum} strokeWidth="3" />
      <path d="M96 20 V38" {...ROUND} stroke={PAPER.moss} strokeWidth="3" />
    </Svg>
  );
}

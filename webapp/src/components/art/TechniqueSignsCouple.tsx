// Знак техники «Стулья в паре» (книга о схема-терапии пар): два стула и над ними три фигуры в ряд —
// пара и терапевт стоят рядом и смотрят на стулья. Какой знак у какой техники — techniqueSigns.ts.
import { PAPER, type ArtProps } from './paper';
import { PaperSvg as Svg } from './PaperSvg';

const ROUND = { fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

/** Три круга-фигуры стоят в ряд над двумя стульями: общая позиция «над сценой». */
export function CoupleChairs({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <circle cx="36" cy="10" r="6" fill={PAPER.clay} />
      <circle cx="60" cy="10" r="6" fill={PAPER.moss} />
      <circle cx="84" cy="10" r="6" fill={PAPER.slate} />
      <path d="M26 24 H46 V44 M26 24 V56 M46 44 H26 M46 44 V56" {...ROUND} stroke={PAPER.clay} strokeWidth="3" />
      <path d="M74 24 H94 V44 M74 24 V56 M94 44 H74 M94 44 V56" {...ROUND} stroke={PAPER.slate} strokeWidth="3" />
      <path d="M14 60 H106" {...ROUND} stroke={PAPER.sage} strokeWidth="3" />
    </Svg>
  );
}

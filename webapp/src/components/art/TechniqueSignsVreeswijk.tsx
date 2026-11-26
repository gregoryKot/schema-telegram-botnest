// Знаки техник «Справочника» из книги ван Фресвайк, Брурсен и Шуринк. Язык тот же: круг — человек,
// линия — внимание, пунктир — то, что проходит и уходит. Какой знак у какой техники — techniqueSigns.ts.
import { PAPER, type ArtProps } from './paper';
import { PaperSvg as Svg } from './PaperSvg';

const ROUND = { fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

/** Трёхминутная пауза: песочные часы — широко заметить, сузить до дыхания, снова расширить на всё тело. */
export function BreathingSpace({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <path d="M34 8 Q60 8 56 32 Q60 56 34 56 M86 8 Q60 8 64 32 Q60 56 86 56" {...ROUND} stroke={PAPER.sage} strokeWidth="3" />
      <path d="M40 14 H80" {...ROUND} stroke={PAPER.amber} strokeWidth="3" strokeDasharray="4 5" />
      <circle cx="60" cy="32" r="5" fill={PAPER.moss} />
      <path d="M36 50 H84" {...ROUND} stroke={PAPER.slate} strokeWidth="3" />
    </Svg>
  );
}

/** Практики осознанности: фигура человека, по которой сверху вниз идут линии внимания — скан тела. */
export function BodyScan({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <circle cx="60" cy="12" r="7" fill={PAPER.plum} />
      <path d="M46 58 V36 Q46 24 60 24 Q74 24 74 36 V58" {...ROUND} stroke={PAPER.sage} strokeWidth="3" />
      <path d="M30 30 H90 M30 42 H90" {...ROUND} stroke={PAPER.amber} strokeWidth="3" strokeDasharray="4 5" />
      <path d="M30 54 H90" {...ROUND} stroke={PAPER.moss} strokeWidth="3" />
    </Svg>
  );
}

/** Осознанность к схеме: очки с цветными линзами — левая окрашена схемой, правая снята, за ней видно больше. */
export function SchemaLens({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <circle cx="40" cy="34" r="16" fill={PAPER.clay} stroke={PAPER.slate} strokeWidth="3" />
      <circle cx="80" cy="34" r="16" {...ROUND} stroke={PAPER.slate} strokeWidth="3" />
      <path d="M56 32 Q60 27 64 32 M24 30 L14 24 M96 30 L106 24" {...ROUND} stroke={PAPER.slate} strokeWidth="3" />
      <path d="M72 34 H88 M76 42 H84" {...ROUND} stroke={PAPER.moss} strokeWidth="3" strokeDasharray="4 5" />
    </Svg>
  );
}

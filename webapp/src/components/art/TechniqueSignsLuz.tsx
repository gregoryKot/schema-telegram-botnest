// Знаки техник «Справочника» из книги Луз и соавторов о детях и подростках. Язык тот же: круг —
// человек, линия — связь. Какой знак у какой техники — techniqueSigns.ts.
import { PAPER, type ArtProps } from './paper';
import { PaperSvg as Svg } from './PaperSvg';

const ROUND = { fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

/** Режимы в игре: три пальчиковые куклы разного цвета, одна выше — режим, который сейчас говорит. */
export function FingerPuppets({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <path d="M22 60 V36 Q22 28 30 28 Q38 28 38 36 V60" {...ROUND} stroke={PAPER.slate} strokeWidth="3" />
      <circle cx="30" cy="20" r="8" fill={PAPER.slate} />
      <path d="M52 60 V28 Q52 20 60 20 Q68 20 68 28 V60" {...ROUND} stroke={PAPER.clay} strokeWidth="3" />
      <circle cx="60" cy="11" r="8" fill={PAPER.clay} />
      <path d="M82 60 V36 Q82 28 90 28 Q98 28 98 36 V60" {...ROUND} stroke={PAPER.moss} strokeWidth="3" />
      <circle cx="90" cy="20" r="8" fill={PAPER.moss} />
      <path d="M12 60 H108" {...ROUND} stroke={PAPER.sage} strokeWidth="3" />
    </Svg>
  );
}

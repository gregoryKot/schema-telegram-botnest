// Знаки техник «Справочника» из книги Луз и соавторов о детях и подростках. Язык тот же: круг —
// человек, линия — связь. Какой знак у какой техники — techniqueSigns.ts.
import { PAPER, type ArtProps } from './paper';
import { PaperSvg as Svg } from './PaperSvg';

const ROUND = {
  fill: 'none',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

/** Режимы в игре: три пальчиковые куклы разного цвета, одна выше — режим, который сейчас говорит. */
export function FingerPuppets({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <path
        d="M22 60 V36 Q22 28 30 28 Q38 28 38 36 V60"
        {...ROUND}
        stroke={PAPER.slate}
        strokeWidth="3"
      />
      <circle cx="30" cy="20" r="8" fill={PAPER.slate} />
      <path
        d="M52 60 V28 Q52 20 60 20 Q68 20 68 28 V60"
        {...ROUND}
        stroke={PAPER.clay}
        strokeWidth="3"
      />
      <circle cx="60" cy="11" r="8" fill={PAPER.clay} />
      <path
        d="M82 60 V36 Q82 28 90 28 Q98 28 98 36 V60"
        {...ROUND}
        stroke={PAPER.moss}
        strokeWidth="3"
      />
      <circle cx="90" cy="20" r="8" fill={PAPER.moss} />
      <path d="M12 60 H108" {...ROUND} stroke={PAPER.sage} strokeWidth="3" />
    </Svg>
  );
}

/** Внутренний дом: три этажа под крышей, на верхнем три куклы, между этажами нить. */
export function InnerHouse({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <path d="M26 24 L60 4 L94 24" {...ROUND} stroke={PAPER.clay} strokeWidth="3" />
      <path d="M30 26 H90 M30 44 H90 M30 62 H90 M34 26 V62 M86 26 V62" {...ROUND} stroke={PAPER.sage} strokeWidth="3" />
      <circle cx="48" cy="35" r="4" fill={PAPER.slate} />
      <circle cx="60" cy="35" r="4" fill={PAPER.clay} />
      <circle cx="72" cy="35" r="4" fill={PAPER.moss} />
      <path d="M60 39 V54" {...ROUND} stroke={PAPER.plum} strokeWidth="2" strokeDasharray="3 3" />
      <circle cx="60" cy="53" r="3" fill={PAPER.amber} />
    </Svg>
  );
}

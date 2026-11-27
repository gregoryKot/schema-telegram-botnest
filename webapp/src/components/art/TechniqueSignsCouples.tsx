// Знаки техник «Справочника» из книги о схема-терапии пар: два круга — партнёры, между ними забота.
// Какой знак у какой техники — techniqueSigns.ts.
import { PAPER, type ArtProps } from './paper';
import { PaperSvg as Svg } from './PaperSvg';

const ROUND = { fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

/** Взаимный репарентинг: двое рядом, над ними маленький круг — ребёнок, которого оберегает дуга-ладонь. */
export function MutualHold({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <circle cx="36" cy="44" r="10" fill={PAPER.clay} />
      <circle cx="84" cy="44" r="10" fill={PAPER.moss} />
      <circle cx="60" cy="22" r="6" fill={PAPER.amber} />
      <path d="M44 30 Q60 52 76 30" {...ROUND} stroke={PAPER.sage} strokeWidth="3" />
    </Svg>
  );
}

/** Дружба пары: двое и общая линия-мостик между ними, на ней отметка вклада. */
export function FriendPair({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <circle cx="26" cy="36" r="10" fill={PAPER.plum} />
      <circle cx="94" cy="36" r="10" fill={PAPER.moss} />
      <path d="M40 36 H80" {...ROUND} stroke={PAPER.sage} strokeWidth="3" />
      <circle cx="60" cy="22" r="5" fill={PAPER.amber} />
      <path d="M60 28 V36" {...ROUND} stroke={PAPER.amber} strokeWidth="3" />
    </Svg>
  );
}

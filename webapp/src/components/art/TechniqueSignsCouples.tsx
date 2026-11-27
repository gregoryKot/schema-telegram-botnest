// Знаки техник «Справочника» из книги о схема-терапии пар.
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

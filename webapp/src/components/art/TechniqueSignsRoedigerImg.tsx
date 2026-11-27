// Знак техники «Образ прощания с умершим» (книга Рёдигера, Стивенс и Брокмана): пустой стул, свеча, клиент напротив.
import { PAPER, type ArtProps } from './paper';
import { PaperSvg as Svg } from './PaperSvg';

const ROUND = {
  fill: 'none',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

/** Прощание: клиент слева, напротив пустой стул пунктиром, над ним огонёк свечи. */
export function FarewellChair({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <circle cx="30" cy="26" r="10" fill={PAPER.clay} />
      <path
        d="M18 58 H42 M22 58 V44 H38 V58"
        {...ROUND}
        stroke={PAPER.sage}
        strokeWidth="3"
      />
      <path
        d="M78 58 H102 M82 58 V38 H98 V58"
        {...ROUND}
        stroke={PAPER.plum}
        strokeWidth="3"
        strokeDasharray="4 5"
      />
      <path d="M90 22 V30" {...ROUND} stroke={PAPER.moss} strokeWidth="3" />
      <path d="M90 8 Q95 14 90 19 Q85 14 90 8 Z" fill={PAPER.amber} />
    </Svg>
  );
}

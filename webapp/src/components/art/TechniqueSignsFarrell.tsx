// Знаки техник «Справочника» из книги Фаррелл, Рейсс и Шоу. Язык тот же: круг — режим, сердце —
// забота, стрелка — шаг вперёд. Какой знак у какой техники — techniqueSigns.ts.
import { HEART_PATH } from './PaperArtSigns';
import { PAPER, type ArtProps } from './paper';
import { PaperSvg as Svg } from './PaperSvg';

const ROUND = { fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

/** План Здорового Взрослого: режим, взгляд заботы, стрелка к ситуации заранее и галочка «сработало». */
export function PlanAhead({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <circle cx="18" cy="32" r="11" fill={PAPER.plum} />
      <path d={HEART_PATH} transform="translate(46 32) scale(.32) translate(-60 -32)" fill={PAPER.clay} />
      <path d="M62 32 H90 M82 23 L91 32 L82 41" {...ROUND} stroke={PAPER.moss} strokeWidth="6" />
      <path d="M99 32 L105 39 L115 24" {...ROUND} stroke={PAPER.sage} strokeWidth="6" />
    </Svg>
  );
}

const LINES = 'M22 30 H34 M22 40 H30 M54 34 H66 M54 44 H62 M86 30 H98 M86 40 H94';

/** План управления режимами: три карточки на одном шнурке, по одной на режим; на каждой две строки. */
export function ModePlan({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <path d="M10 10 Q60 22 110 10" {...ROUND} stroke={PAPER.sage} strokeWidth="4" />
      <rect x="16" y="18" width="24" height="34" rx="4" fill={PAPER.moss} />
      <rect x="48" y="22" width="24" height="34" rx="4" fill={PAPER.slate} />
      <rect x="80" y="18" width="24" height="34" rx="4" fill={PAPER.plum} />
      <path d={LINES} {...ROUND} stroke={PAPER.clay} strokeWidth="3" />
    </Svg>
  );
}

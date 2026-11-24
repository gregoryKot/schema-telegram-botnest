// Знаки техник «Справочника» из книги Хис и Стартап. Язык тот же: круг — человек или режим, лист — рисунок,
// волна — голос, пунктир — отклик тела. Какой знак у какой техники — techniqueSigns.ts.
import { PAPER, type ArtProps } from './paper';
import { PaperSvg as Svg } from './PaperSvg';

const ROUND = { fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

/** Креативная работа с режимами: лист-маска Критика с прорезями глаз, рядом маленький режим-ребёнок. */
export function CriticMask({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <rect x="22" y="8" width="44" height="48" rx="6" fill={PAPER.plum} />
      <path d="M32 26 L40 30 M56 26 L48 30 M34 44 Q44 38 54 44" {...ROUND} stroke={PAPER.amber} strokeWidth="4" />
      <path d="M74 14 L82 8" {...ROUND} stroke={PAPER.clay} strokeWidth="4" strokeDasharray="4 5" />
      <circle cx="96" cy="40" r="10" fill={PAPER.moss} />
    </Svg>
  );
}

/** Фразы-зонды: голос терапевта тремя волнами доходит до клиента, и тот слушает отклик тела. */
export function ProbePhrase({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <circle cx="16" cy="32" r="10" fill={PAPER.moss} />
      <path d="M34 22 Q40 32 34 42 M44 16 Q53 32 44 48 M54 10 Q66 32 54 54" {...ROUND} stroke={PAPER.sage} strokeWidth="4" />
      <circle cx="92" cy="32" r="13" fill={PAPER.clay} />
      <circle cx="92" cy="32" r="22" fill="none" stroke={PAPER.amber} strokeWidth="3" strokeDasharray="4 5" />
    </Svg>
  );
}

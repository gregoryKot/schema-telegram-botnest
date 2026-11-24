// Знаки техник «Справочника» из книги Хис и Стартап. Язык тот же: круг — человек, волна — голос,
// пунктир — отклик тела. Какой знак у какой техники — techniqueSigns.ts.
import { PAPER, type ArtProps } from './paper';
import { PaperSvg as Svg } from './PaperSvg';

const ROUND = { fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

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

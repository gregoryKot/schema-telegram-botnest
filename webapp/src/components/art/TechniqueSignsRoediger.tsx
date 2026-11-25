// Знаки техник «Справочника» из книги Рёдигера, Стивенс и Брокмана. Язык тот же: круг — человек,
// линия — связь, пунктир — то, что передаётся дальше. Какой знак у какой техники — techniqueSigns.ts.
import { PAPER, type ArtProps } from './paper';
import { PaperSvg as Svg } from './PaperSvg';

const ROUND = { fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

/** Генограмма: три поколения кругами, линии брака и потомства, пунктир — паттерн, идущий вниз по роду. */
export function Genogram({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <path d="M30 10 H50 M40 10 V24 M70 10 H90 M80 10 V24 M40 24 H80 M60 24 V44" {...ROUND} stroke={PAPER.sage} strokeWidth="3" />
      <circle cx="24" cy="10" r="6" fill={PAPER.plum} />
      <circle cx="56" cy="10" r="6" fill={PAPER.amber} />
      <circle cx="64" cy="10" r="6" fill={PAPER.moss} />
      <circle cx="96" cy="10" r="6" fill={PAPER.amber} />
      <circle cx="40" cy="30" r="6" fill={PAPER.plum} />
      <circle cx="80" cy="30" r="6" fill={PAPER.moss} />
      <circle cx="60" cy="52" r="9" fill={PAPER.clay} />
      <path d="M24 18 Q30 40 50 52" {...ROUND} stroke={PAPER.plum} strokeWidth="3" strokeDasharray="4 5" />
    </Svg>
  );
}

// Знаки техник «Справочника» из книги Фаррелл, Рейсс и Шоу о групповой схема-терапии
// (docs/design/PAPER_2026-11.md, таблица техник). Круг — человек; какой знак у какой техники — techniqueSigns.ts.
import { PAPER, type ArtProps } from './paper';
import { PaperSvg as Svg } from './PaperSvg';

const BOX = '0 0 120 64';

/** Пузырь безопасности: трое в общем круге, снаружи — пунктирный голос Критика, который не проходит. */
export function SafetyBubble({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox={BOX}>
      <circle
        cx="56"
        cy="32"
        r="27"
        fill="none"
        stroke={PAPER.sage}
        strokeWidth="5"
      />
      <circle cx="44" cy="38" r="7" fill={PAPER.moss} />
      <circle cx="58" cy="24" r="7" fill={PAPER.amber} />
      <circle cx="70" cy="39" r="7" fill={PAPER.slate} />
      <circle
        cx="104"
        cy="32"
        r="9"
        fill="none"
        stroke={PAPER.clay}
        strokeWidth="4"
        strokeDasharray="5 5"
      />
    </Svg>
  );
}

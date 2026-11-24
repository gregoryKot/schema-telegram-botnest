// Свой знак раздела «Для терапевта» по книге Янга (practiceSignsYoung.ts): готовые мотивы ему врут.
import { PAPER, type ArtProps } from './paper';
import { PaperSvg as Svg } from './PaperSvg';

/** Одно поведение — разные схемы: одна ровная лента сверху, под ней три разных круга — корни у одного и того же поступка разные. */
export function Roots({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <path d="M16 14 H104" stroke={PAPER.sage} strokeWidth="8" strokeLinecap="round" />
      <path d="M32 22 V36 M60 22 V36 M88 22 V36" stroke={PAPER.sage} strokeWidth="3" strokeLinecap="round" />
      <circle cx="32" cy="47" r="10" fill={PAPER.clay} />
      <circle cx="60" cy="47" r="10" fill={PAPER.slate} />
      <circle cx="88" cy="47" r="10" fill={PAPER.moss} />
    </Svg>
  );
}

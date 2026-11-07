// Знаки разделов «Для терапевта» (docs/design/PAPER_2026-11.md, «Язык знаков»): восемь из
// десяти берут готовый мотив (guideSignsModel.ts, PRACTICE_NOTE_SIGN), здесь — два, которым
// готовый врёт. «Болтовня»: Talk — живой разговор двух людей, а тут реплики, за которыми
// клиента не видно. «Клиент злится»: Looming — давящий Критик, а злость — не он.
import { PAPER, type ArtProps } from './paper';
import { PaperSvg as Svg } from './PaperSvg';

/** «Болтовня» вместо терапии: реплики заслонили маленький круг глины — за разговором не видно уязвимой части. */
export function Chatter({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <circle cx="96" cy="50" r="10" fill={PAPER.clay} />
      <ellipse cx="34" cy="24" rx="26" ry="15" fill={PAPER.slate} fillOpacity=".45" />
      <path d="M18 35 L 12 46 L 30 38 Z" fill={PAPER.slate} fillOpacity=".45" />
      <ellipse cx="74" cy="32" rx="30" ry="16" fill={PAPER.sage} />
      <path d="M58 44 L 52 56 L 70 46 Z" fill={PAPER.sage} />
    </Svg>
  );
}

const FLARE_D =
  'M44 8 L49.2 15.2 L57.5 12 L58 20.9 L66.7 22.6 L62.3 30.4 L68.7 36.6 L60.8 40.7 L62.9 49.4 L54 48.6 ' +
  'L51 57 L44 51.5 L37 57 L34 48.6 L25.1 49.4 L27.2 40.7 L19.3 36.6 L25.7 30.4 L21.3 22.6 L30 20.9 L30.5 12 L38.8 15.2 Z';

/** Клиент злится: часть вспыхнула зубчатым кругом глины; рядом на той же земле — ровный круг мха, терапевт не спорит, а встаёт рядом. */
export function Flare({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <path d="M12 59 H108" stroke={PAPER.sage} strokeWidth="4" strokeLinecap="round" />
      <path d={FLARE_D} fill={PAPER.clay} />
      <circle cx="90" cy="44" r="13" fill={PAPER.moss} />
    </Svg>
  );
}

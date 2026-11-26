// Знаки техник «Справочника» из книги Рёдигера, Стивенс и Брокмана (и заметки «баланс сессии»). Круг — человек,
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

/** Смена точки зрения: двое стоят рядом над тремя стульями режимов, взгляд вниз — на сцену. */
export function StandAbove({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <circle cx="50" cy="10" r="6" fill={PAPER.clay} />
      <circle cx="70" cy="10" r="6" fill={PAPER.moss} />
      <path d="M50 18 V30 M70 18 V30" {...ROUND} stroke={PAPER.sage} strokeWidth="3" />
      <path d="M52 32 L36 44 M68 32 L84 44" {...ROUND} stroke={PAPER.sage} strokeWidth="2" strokeDasharray="3 4" />
      <path d="M22 48 H40 V58 M52 48 H68 V58 M80 48 H98 V58" {...ROUND} stroke={PAPER.plum} strokeWidth="3" />
    </Svg>
  );
}

/** Баланс сессии: две оси крестом, точка сессии смещена туда, чего клиенту не хватает. */
export function BalanceAxes({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <path d="M60 6 V58 M24 32 H96" {...ROUND} stroke={PAPER.sage} strokeWidth="3" />
      <path d="M54 12 L60 6 L66 12 M54 52 L60 58 L66 52" {...ROUND} stroke={PAPER.plum} strokeWidth="3" />
      <path d="M30 26 L24 32 L30 38 M90 26 L96 32 L90 38" {...ROUND} stroke={PAPER.amber} strokeWidth="3" />
      <circle cx="72" cy="22" r="7" fill={PAPER.clay} />
      <path d="M60 32 L68 25" {...ROUND} stroke={PAPER.clay} strokeWidth="2" strokeDasharray="3 4" />
    </Svg>
  );
}

/** Тело и место терапевта: клиент на стуле, терапевт рядом и чуть позади; пустое место «напротив» — пунктиром. */
export function BodyModePositions({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <path d="M50 52 H80 M54 52 V40 H76 V52" {...ROUND} stroke={PAPER.sage} strokeWidth="3" />
      <circle cx="65" cy="26" r="10" fill={PAPER.clay} />
      <circle cx="38" cy="32" r="8" fill={PAPER.moss} />
      <path d="M40 46 Q48 52 54 46" {...ROUND} stroke={PAPER.amber} strokeWidth="3" />
      <circle cx="102" cy="28" r="9" fill="none" stroke={PAPER.plum} strokeWidth="3" strokeDasharray="4 5" />
    </Svg>
  );
}

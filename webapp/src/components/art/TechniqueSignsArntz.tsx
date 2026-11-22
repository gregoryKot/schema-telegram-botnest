// Знаки техник «Справочника» из книги Арнца и ван Гендерен о ПРЛ (docs/design/PAPER_2026-11.md,
// таблица техник). Язык тот же: круг — часть или человек; камешек — мысль на месте; сердце —
// потребность. Какой знак у какой техники — techniqueSigns.ts.
import { HEART_PATH } from './PaperArtSigns';
import { PAPER, type ArtProps } from './paper';
import { PaperSvg as Svg } from './PaperSvg';

const ROUND = { fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const BOX = '0 0 120 64';

/** Проверка связи на двух осях: люди-точки ложатся облаком, а не вдоль пунктирной диагонали правила. */
export function Scatter({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox={BOX}>
      <path d="M20 6 V58 H112" {...ROUND} stroke={PAPER.sage} strokeWidth="6" />
      <path d="M30 50 L104 12" {...ROUND} stroke={PAPER.clay} strokeWidth="4" strokeDasharray="6 7" />
      <circle cx="44" cy="20" r="6" fill={PAPER.moss} />
      <circle cx="62" cy="44" r="6" fill={PAPER.slate} />
      <circle cx="80" cy="18" r="6" fill={PAPER.moss} />
      <circle cx="94" cy="46" r="6" fill={PAPER.slate} />
      <circle cx="70" cy="30" r="6" fill={PAPER.amber} />
    </Svg>
  );
}

/** Цикл самонаблюдения: по кругу шаги — тело, мысли, чувства, режим, факты; в центре потребность. */
export function NeedCycle({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox={BOX}>
      <circle cx="60" cy="32" r="25" fill="none" stroke={PAPER.sage} strokeWidth="5" />
      <circle cx="60" cy="7" r="6" fill={PAPER.moss} />
      <circle cx="84" cy="24" r="6" fill={PAPER.slate} />
      <circle cx="75" cy="52" r="6" fill={PAPER.plum} />
      <circle cx="45" cy="52" r="6" fill={PAPER.moss} />
      <circle cx="36" cy="24" r="6" fill={PAPER.slate} />
      <path d={HEART_PATH} transform="translate(60 34) scale(.3) translate(-60 -32)" fill={PAPER.clay} />
    </Svg>
  );
}

/** «Угадай режим»: терапевт-круг показывает режим клиента, рядом его отражение пунктиром — догадка. */
export function GuessMode({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox={BOX}>
      <circle cx="36" cy="34" r="22" fill={PAPER.moss} />
      <circle cx="48" cy="22" r="11" fill={PAPER.plum} />
      <circle cx="90" cy="34" r="17" fill="none" stroke={PAPER.plum} strokeWidth="5" strokeDasharray="6 6" />
    </Svg>
  );
}

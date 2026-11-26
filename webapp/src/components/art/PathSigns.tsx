// Знаки вкладки «Путь терапии»: обзор и шесть стадий по порядку пути (docs/design/PAPER_2026-11.md, таблица
// «Путь терапии»). Язык тот же, что у техник: полоска — живая сила клиента, лента — то, что зацепило,
// камешек — веха, лист — рост. Какой знак у какого листа — shared/src/theme/pathLook.ts.
import { PAPER, type ArtProps } from './paper';
import { PaperSvg as Svg } from './PaperSvg';
import { Ground } from './techniqueSignParts';

const ROUND = { fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const BOX = '0 0 120 64';

/** Обзор: извилистая тропа с тремя вехами-камешками, на конце — росток. */
export function PathOverview({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox={BOX}>
      <path d="M10 54 C 34 54, 38 34, 58 36 S 84 54, 96 34" {...ROUND} stroke={PAPER.sage} strokeWidth="6" />
      <ellipse cx="22" cy="48" rx="8" ry="5.5" fill={PAPER.clay} />
      <ellipse cx="62" cy="37" rx="8" ry="5.5" fill={PAPER.amber} />
      <path d="M96 34 C 96 24, 98 16, 104 8" {...ROUND} stroke={PAPER.moss} strokeWidth="5" />
      <path d="M102 10 C 102 0, 112 -2, 118 2 C 118 12, 110 16, 102 10 Z" fill={PAPER.moss} />
    </Svg>
  );
}

/** Оценка: лист-карта со строками и линза над ним. */
export function PathAssessment({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox={BOX}>
      <rect x="14" y="6" width="56" height="52" rx="8" transform="rotate(-4 42 32)" fill={PAPER.sage} />
      <rect x="24" y="18" width="36" height="7" rx="3.5" fill={PAPER.moss} />
      <rect x="24" y="32" width="26" height="7" rx="3.5" fill={PAPER.moss} />
      <circle cx="80" cy="34" r="15" fill={PAPER.hollow} stroke={PAPER.plum} strokeWidth="6" />
      <path d="M91 45 L 106 58" {...ROUND} stroke={PAPER.plum} strokeWidth="7" />
    </Svg>
  );
}

/** Безопасность и связь: две полоски рядом под дугой-укрытием. */
export function PathSafety({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox={BOX}>
      <path d="M16 44 C 16 4, 104 4, 104 44" {...ROUND} stroke={PAPER.sage} strokeWidth="6" />
      <rect x="40" y="22" width="16" height="36" rx="8" fill={PAPER.moss} />
      <rect x="64" y="26" width="16" height="32" rx="8" fill={PAPER.clay} />
    </Svg>
  );
}

/** Осознание: полоска и её контур-отражение пунктиром, между ними лента-момент. */
export function PathAwareness({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox={BOX}>
      <rect x="22" y="8" width="18" height="48" rx="9" fill={PAPER.moss} />
      <rect x="80" y="8" width="18" height="48" rx="9" fill={PAPER.hollow} stroke={PAPER.moss} strokeWidth="3" strokeDasharray="5 5" />
      <path d="M46 32 C 52 22, 58 42, 64 32 S 70 26, 74 32" {...ROUND} stroke={PAPER.clay} strokeWidth="5" />
    </Svg>
  );
}

/** Управление режимами: полоска придерживает ленту — слева она вьётся, справа легла ровно. */
export function PathManaging({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox={BOX}>
      <path d="M8 32 C 16 12, 26 52, 34 32 S 44 22, 52 32" {...ROUND} stroke={PAPER.clay} strokeWidth="6" />
      <path d="M68 32 H112" {...ROUND} stroke={PAPER.clay} strokeWidth="6" />
      <rect x="50" y="8" width="18" height="48" rx="9" fill={PAPER.moss} />
    </Svg>
  );
}

/** Исцеление: лист с трещиной, стянутой стежками, справа — росток. */
export function PathHealing({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox={BOX}>
      <rect x="10" y="6" width="62" height="52" rx="8" fill={PAPER.sage} />
      <path d="M42 6 L 34 22 L 48 34 L 38 58" {...ROUND} stroke={PAPER.brown} strokeWidth="3.5" />
      <path d="M28 20 H44 M30 34 H48 M30 48 H46" {...ROUND} stroke={PAPER.clay} strokeWidth="5" />
      <path d="M96 58 C 96 48, 96 40, 98 30" {...ROUND} stroke={PAPER.moss} strokeWidth="5" />
      <path d="M97 32 C 96 18, 106 12, 118 14 C 118 26, 108 34, 97 32 Z" fill={PAPER.moss} />
      <path d="M96 44 C 90 40, 86 36, 84 30 C 92 30, 96 36, 96 44 Z" fill={PAPER.amber} />
    </Svg>
  );
}

/** Автономия: полоска идёт к горизонту через открытый проём, за ним солнце. */
export function PathAutonomy({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox={BOX}>
      <Ground y={58} />
      <circle cx="88" cy="32" r="8" fill={PAPER.amber} />
      <path d="M70 58 V 24 C 70 2, 106 2, 106 24 V 58" {...ROUND} stroke={PAPER.sage} strokeWidth="6" />
      <path d="M8 58 H112" {...ROUND} stroke={PAPER.sage} strokeWidth="5" />
      <rect x="30" y="20" width="16" height="38" rx="8" fill={PAPER.moss} />
    </Svg>
  );
}

// Знаки сквозных тем «Пути терапии» и общий знак шаблона пути (docs/design/PAPER_2026-11.md, таблица
// «Путь терапии»). Язык тот же, что у стадий (PathSigns.tsx). Какой знак у какого листа — shared/src/theme/pathLook.ts.
import { PAPER, type ArtProps } from './paper';
import { PaperSvg as Svg } from './PaperSvg';

const ROUND = { fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const BOX = '0 0 120 64';

/** Порядок режимов: три ступени, на каждой стоит своя полоска. */
export function PathModeOrder({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox={BOX}>
      <rect x="6" y="46" width="34" height="14" rx="5" fill={PAPER.sage} />
      <rect x="43" y="34" width="34" height="26" rx="5" fill={PAPER.sage} />
      <rect x="80" y="22" width="34" height="38" rx="5" fill={PAPER.sage} />
      <rect x="16" y="28" width="12" height="18" rx="6" fill={PAPER.clay} />
      <rect x="54" y="16" width="12" height="18" rx="6" fill={PAPER.amber} />
      <rect x="91" y="4" width="12" height="18" rx="6" fill={PAPER.moss} />
    </Svg>
  );
}

/** Техники во времени: линия времени с разными метками — камешек, полоска, солнце, лист. */
export function PathTimeline({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox={BOX}>
      <path d="M6 36 H114" {...ROUND} stroke={PAPER.sage} strokeWidth="6" />
      <ellipse cx="20" cy="18" rx="9" ry="6" fill={PAPER.clay} />
      <rect x="40" y="38" width="11" height="20" rx="5.5" fill={PAPER.moss} />
      <circle cx="70" cy="18" r="7" fill={PAPER.amber} />
      <path d="M90 40 C 90 54, 100 58, 110 56 C 110 44, 100 38, 90 40 Z" fill={PAPER.moss} />
    </Svg>
  );
}

/** Структура сессии: рамка из трёх частей — короткое начало, длинная середина, средний конец. */
export function PathSession({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox={BOX}>
      <rect x="12" y="6" width="96" height="52" rx="10" fill="none" stroke={PAPER.sage} strokeWidth="5" />
      <rect x="20" y="32" width="22" height="18" rx="5" fill={PAPER.clay} />
      <rect x="49" y="14" width="22" height="36" rx="5" fill={PAPER.moss} />
      <rect x="78" y="24" width="22" height="26" rx="5" fill={PAPER.amber} />
    </Svg>
  );
}

/** Маркеры прогресса: три флажка-вехи на растущих древках. */
export function PathProgress({ size }: ArtProps) {
  const pole = { ...ROUND, stroke: PAPER.brown, strokeWidth: 4 } as const;
  return (
    <Svg size={size} viewBox={BOX}>
      <path d="M6 58 H114" {...ROUND} stroke={PAPER.sage} strokeWidth="5" />
      <path d="M24 58 V30 M58 58 V20 M92 58 V8" {...pole} />
      <path d="M24 30 L 42 37 L 24 44 Z" fill={PAPER.clay} />
      <path d="M58 20 L 76 27 L 58 34 Z" fill={PAPER.amber} />
      <path d="M92 8 L 110 15 L 92 22 Z" fill={PAPER.moss} />
    </Svg>
  );
}

/** Застревание: узел на ленте. */
export function PathStuck({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox={BOX}>
      <path
        d="M6 44 H34 C 54 44, 60 12, 76 22 C 92 32, 66 56, 56 38 C 50 28, 74 20, 88 36 C 96 46, 102 44, 114 44"
        {...ROUND} stroke={PAPER.clay} strokeWidth="6"
      />
    </Svg>
  );
}

/** Чек-лист новичка: лист со строками, у двух галочки, третья ещё пустая. */
export function PathChecklist({ size }: ArtProps) {
  const tick = { ...ROUND, stroke: PAPER.moss, strokeWidth: 4 } as const;
  return (
    <Svg size={size} viewBox={BOX}>
      <rect x="28" y="4" width="64" height="56" rx="8" fill={PAPER.sage} />
      <path d="M38 17 L 42 21 L 49 12 M38 31 L 42 35 L 49 26" {...tick} />
      <circle cx="43" cy="46" r="5" fill={PAPER.hollow} stroke={PAPER.moss} strokeWidth="2.5" />
      <rect x="57" y="14" width="24" height="7" rx="3.5" fill={PAPER.moss} />
      <rect x="57" y="28" width="18" height="7" rx="3.5" fill={PAPER.moss} />
      <rect x="57" y="43" width="22" height="7" rx="3.5" fill={PAPER.moss} />
    </Svg>
  );
}

/** Протоколы: стопка листов, на верхнем — деления недель. */
export function PathProtocols({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox={BOX}>
      <rect x="14" y="4" width="72" height="44" rx="7" transform="rotate(-5 50 26)" fill={PAPER.sage} />
      <rect x="22" y="10" width="72" height="44" rx="7" transform="rotate(-2 58 32)" fill={PAPER.amber} />
      <rect x="30" y="16" width="76" height="44" rx="7" fill={PAPER.moss} />
      <path d="M44 28 V48 M58 28 V48 M72 28 V48 M86 28 V48" {...ROUND} stroke={PAPER.sage} strokeWidth="4" />
      <rect x="40" y="34" width="36" height="7" rx="3.5" fill={PAPER.clay} />
    </Svg>
  );
}

/** Шаблон пути: полоски разной длины по неделям — раскладка фаз по сетке. */
export function PathTemplate({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox={BOX}>
      <path d="M36 4 V60 M64 4 V60 M92 4 V60" {...ROUND} stroke={PAPER.hollow} strokeWidth="3" />
      <rect x="8" y="6" width="34" height="9" rx="4.5" fill={PAPER.clay} />
      <rect x="30" y="20" width="44" height="9" rx="4.5" fill={PAPER.moss} />
      <rect x="62" y="34" width="30" height="9" rx="4.5" fill={PAPER.amber} />
      <rect x="82" y="48" width="30" height="9" rx="4.5" fill={PAPER.plum} />
    </Svg>
  );
}

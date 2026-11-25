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

/** Диалог близости: два человека лицом друг к другу, между ними — просьба и ответ двумя встречными дугами. */
export function IntimacyDialogue({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <circle cx="18" cy="34" r="11" fill={PAPER.clay} />
      <circle cx="102" cy="34" r="11" fill={PAPER.moss} />
      <path d="M34 28 Q60 12 86 28" {...ROUND} stroke={PAPER.amber} strokeWidth="4" />
      <path d="M86 40 Q60 56 34 40" {...ROUND} stroke={PAPER.sage} strokeWidth="4" strokeDasharray="4 5" />
    </Svg>
  );
}

/** Медитация на три части: пунктирный контур тела, внутри три круга — Уязвимый Ребёнок, Счастливый Ребёнок, Здоровый Взрослый. */
export function ThreeParts({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <rect x="28" y="4" width="64" height="56" rx="28" fill="none" stroke={PAPER.sage} strokeWidth="3" strokeDasharray="4 5" />
      <circle cx="46" cy="40" r="9" fill={PAPER.clay} />
      <circle cx="74" cy="40" r="9" fill={PAPER.amber} />
      <circle cx="60" cy="20" r="10" fill={PAPER.moss} />
    </Svg>
  );
}

/** Карта травмы: три круга-события на листе, связанные линиями по сходству. */
export function TraumaMap({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <path d="M26 20 L60 44 L96 22 M26 20 L96 22" {...ROUND} stroke={PAPER.amber} strokeWidth="3" strokeDasharray="4 5" />
      <circle cx="26" cy="20" r="10" fill={PAPER.clay} />
      <circle cx="60" cy="44" r="10" fill={PAPER.plum} />
      <circle cx="96" cy="22" r="10" fill={PAPER.clay} />
    </Svg>
  );
}

/** Рескриптинг недавнего события: дверь-рамка сцены, внутри два режима и над ними взрослый, видящий всё. */
export function RecentScene({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <rect x="20" y="6" width="80" height="52" rx="6" {...ROUND} stroke={PAPER.sage} strokeWidth="4" />
      <circle cx="42" cy="44" r="7" fill={PAPER.clay} />
      <circle cx="78" cy="44" r="7" fill={PAPER.amber} />
      <circle cx="60" cy="22" r="9" fill={PAPER.moss} />
    </Svg>
  );
}

/** Ментальный контраст: путь к цели упирается в препятствие и огибает его развилкой «если — тогда». */
export function IfThen({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <path d="M10 40 L44 40 Q56 40 60 26 Q64 12 82 14" {...ROUND} stroke={PAPER.moss} strokeWidth="4" />
      <rect x="52" y="34" width="14" height="14" rx="3" fill={PAPER.clay} />
      <circle cx="98" cy="14" r="9" fill={PAPER.amber} />
    </Svg>
  );
}

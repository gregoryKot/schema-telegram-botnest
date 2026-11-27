// Знаки техник «Справочника» из тетради Фаррелл и Шоу. Круг — режим, точки — окна бланка,
// строки — записи. Какой знак у какой техники — techniqueSigns.ts.
import { PAPER, type ArtProps } from './paper';
import { PaperSvg as Svg } from './PaperSvg';

const ROUND = { fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

/** Цикл самомониторинга: окна по кругу, в центре — потребность, стрелка ведёт к итогу. */
export function MonitorRing({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <circle cx="60" cy="32" r="22" fill="none" stroke={PAPER.sage} strokeWidth="4" strokeDasharray="10 6" />
      <circle cx="60" cy="10" r="5" fill={PAPER.plum} />
      <circle cx="82" cy="32" r="5" fill={PAPER.amber} />
      <circle cx="60" cy="54" r="5" fill={PAPER.slate} />
      <circle cx="38" cy="32" r="5" fill={PAPER.clay} />
      <circle cx="60" cy="32" r="7" fill={PAPER.moss} />
      <path d="M92 32 H110 M104 26 L110 32 L104 38" {...ROUND} stroke={PAPER.moss} strokeWidth="4" />
    </Svg>
  );
}

/** Резюме осознания режима: режим слева, рядом лист со строками-признаками. */
export function ModePage({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <circle cx="26" cy="32" r="13" fill={PAPER.slate} />
      <rect x="52" y="8" width="52" height="48" rx="6" fill="none" stroke={PAPER.sage} strokeWidth="4" />
      <path d="M62 20 H94 M62 32 H88 M62 44 H80" {...ROUND} stroke={PAPER.amber} strokeWidth="4" />
    </Svg>
  );
}

/** Обзор по режимам: три режима друг под другом, у каждого строка «изменилось» и галочка. */
export function ReviewRows({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <circle cx="18" cy="14" r="6" fill={PAPER.clay} />
      <circle cx="18" cy="32" r="6" fill={PAPER.plum} />
      <circle cx="18" cy="50" r="6" fill={PAPER.moss} />
      <path d="M34 14 H78 M34 32 H70 M34 50 H84" {...ROUND} stroke={PAPER.sage} strokeWidth="4" />
      <path d="M94 32 L100 39 L112 22" {...ROUND} stroke={PAPER.moss} strokeWidth="5" />
    </Svg>
  );
}

// Пять доменов схем (docs/TERMINOLOGY.md) — по мотиву на домен: 1 разрыв связи и
// отвержение — две формы врозь; 2 нарушенная автономия — полоска опирается на
// другую; 3 нарушенные границы — полоска выходит из рамки; 4 направленность
// на других — маленький круг под большой дугой; 5 сверхбдительность и
// подавление — глаз: овал с точкой. Цвета только из палитры бумаги.
import { PAPER, type ArtProps } from './paper';
import { PaperSvg as Svg } from './PaperSvg';

function D1({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <circle cx="34" cy="32" r="20" fill={PAPER.clay} />
      <path d="M86 12 A20 20 0 0 1 86 52 Z" fill={PAPER.sage} />
    </Svg>
  );
}
function D2({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <rect x="66" y="8" width="16" height="50" rx="8" fill={PAPER.moss} />
      <rect x="30" y="14" width="16" height="48" rx="8" transform="rotate(-22 38 38)" fill={PAPER.clay} />
    </Svg>
  );
}
function D3({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <rect x="18" y="14" width="64" height="40" rx="10" fill="none" stroke={PAPER.sage} strokeWidth="8" />
      <rect x="54" y="26" width="56" height="12" rx="6" fill={PAPER.clay} />
    </Svg>
  );
}
function D4({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <path d="M14 36 A46 46 0 0 1 106 36" fill="none" stroke={PAPER.moss} strokeWidth="11" strokeLinecap="round" />
      <circle cx="60" cy="48" r="9" fill={PAPER.clay} />
    </Svg>
  );
}
function D5({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <ellipse cx="60" cy="32" rx="40" ry="20" fill={PAPER.sage} />
      <circle cx="60" cy="32" r="11" fill={PAPER.brown} />
      <circle cx="64" cy="28" r="3" fill={PAPER.sage} />
    </Svg>
  );
}

const BY_DOMAIN = [D1, D2, D3, D4, D5];

/** Мотив домена схем по номеру 1–5; другой номер — ничего. */
export function DomainArt({ domain, size }: ArtProps & { domain: number }) {
  const Art = BY_DOMAIN[domain - 1];
  return Art ? <Art size={size} /> : null;
}

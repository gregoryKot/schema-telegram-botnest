// Пять доменов схем — тот же язык знаков, что у потребностей: полоска —
// потребность, домен — что с ней случилось в детстве (docs/design/PAPER_2026-11.md).
// 1 разрыв связи и отвержение — две полоски отвернулись врозь; 2 нарушенная
// автономия — полоска держится, опираясь на другую; 3 нарушенные границы —
// полоска вылезла из рамки; 4 направленность на других — своя полоска
// пригнулась под чужой дугой; 5 сверхбдительность и подавление — полоска
// зажата между двумя перекладинами. Цвета только из палитры бумаги.
import { PAPER, type ArtProps } from './paper';
import { PaperSvg as Svg } from './PaperSvg';

function Stroke({ x, h, deg = 0, fill, y }: { x: number; h: number; deg?: number; fill: string; y?: number }) {
  return <rect x={x} y={y ?? 60 - h} width="16" height={h} rx="8" fill={fill} transform={`rotate(${deg} ${x + 8} 60)`} />;
}

function D1({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <Stroke x={22} h={50} deg={-18} fill={PAPER.clay} />
      <Stroke x={82} h={50} deg={18} fill={PAPER.sage} />
    </Svg>
  );
}
function D2({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <Stroke x={66} h={54} fill={PAPER.moss} />
      <Stroke x={38} h={50} deg={26} fill={PAPER.clay} />
    </Svg>
  );
}
function D3({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <rect x="22" y="12" width="60" height="48" rx="12" fill="none" stroke={PAPER.sage} strokeWidth="8" />
      <Stroke x={70} h={56} deg={-28} fill={PAPER.clay} />
    </Svg>
  );
}
function D4({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <path d="M12 54 A48 48 0 0 1 108 54" fill="none" stroke={PAPER.moss} strokeWidth="11" strokeLinecap="round" />
      <Stroke x={52} h={30} deg={30} fill={PAPER.clay} />
    </Svg>
  );
}
function D5({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <rect x="18" y="8" width="84" height="10" rx="5" fill={PAPER.brown} />
      <rect x="18" y="50" width="84" height="10" rx="5" fill={PAPER.brown} />
      <Stroke x={52} h={28} fill={PAPER.clay} y={20} />
    </Svg>
  );
}

const BY_DOMAIN = [D1, D2, D3, D4, D5];

/** Мотив домена схем по номеру 1–5; другой номер — ничего. */
export function DomainArt({ domain, size }: ArtProps & { domain: number }) {
  const Art = BY_DOMAIN[domain - 1];
  return Art ? <Art size={size} /> : null;
}

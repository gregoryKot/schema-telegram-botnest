// Знаки групп режимов — тот же язык, что у клиента (docs/design/PAPER_2026-11.md): круги —
// части-режимы, рамка — граница, линия — земля, на которой стоят, лист — рост. Знак говорит,
// что с этой частью происходит и что с ней делают в терапии. Своя часть — маленький круг
// глины; цвет главного элемента — оттенок группы на карте режимов (MODE_GROUP_HUE):
// копинги — сланец, критики — слива, здоровые — мох. Какая группа каким знаком —
// MODE_GROUP_SIGN (shared/src/theme/entityLook.ts); рисунок по ключу — SignArt.tsx.
import { PAPER, type ArtProps } from './paper';
import { PaperSvg as Svg } from './PaperSvg';

/** Детские режимы: маленький круг в объятиях большого — о ребёнке заботятся. */
export function ChildCare({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <path d="M39.5 17.7 A25 25 0 1 0 80.5 17.7" fill="none" stroke={PAPER.sage} strokeWidth="13" strokeLinecap="round" />
      <circle cx="60" cy="35" r="11" fill={PAPER.clay} />
    </Svg>
  );
}

/** Капитуляция: своя часть прижалась к большому чужому кругу и изогнулась по его краю. */
export function Yield({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <circle cx="50" cy="32" r="26" fill={PAPER.slate} />
      <path d="M81.4 16.7 A35 35 0 0 1 81.4 47.3" fill="none" stroke={PAPER.clay} strokeWidth="13" strokeLinecap="round" />
    </Svg>
  );
}

/** Избегание: своя часть за рамкой, остальные круги поодаль — отгородился, чтобы не чувствовать. */
export function Shelter({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <rect x="12" y="8" width="48" height="48" rx="13" fill="none" stroke={PAPER.slate} strokeWidth="7" />
      <circle cx="36" cy="32" r="10" fill={PAPER.clay} />
      <circle cx="88" cy="22" r="11" fill={PAPER.sage} />
      <circle cx="106" cy="44" r="8" fill={PAPER.moss} />
    </Svg>
  );
}

/** Гиперкомпенсация: толстое кольцо-щит, а внутри всё тот же маленький круг. */
export function Shield({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <circle cx="60" cy="32" r="23" fill="none" stroke={PAPER.slate} strokeWidth="14" />
      <circle cx="60" cy="40" r="8" fill={PAPER.clay} />
    </Svg>
  );
}

/** Критикующие режимы: тяжёлый круг навис сверху, маленький сжался к земле. */
export function Looming({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <path d="M14 61 H106" stroke={PAPER.sage} strokeWidth="4" strokeLinecap="round" />
      <circle cx="52" cy="23" r="21" fill={PAPER.plum} />
      <ellipse cx="70" cy="53" rx="14" ry="6" fill={PAPER.clay} />
    </Svg>
  );
}

/** Здоровые режимы: большой и маленький круг рядом на одной линии, рядом растёт лист. */
export function Together({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <path d="M10 58 H110" stroke={PAPER.sage} strokeWidth="4" strokeLinecap="round" />
      <circle cx="40" cy="35" r="21" fill={PAPER.moss} />
      <circle cx="72" cy="46" r="10" fill={PAPER.clay} />
      <path d="M94 56 C 88 40, 96 26, 112 22 C 114 38, 108 52, 94 56 Z" fill={PAPER.moss} />
    </Svg>
  );
}

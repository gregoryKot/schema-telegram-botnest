// Вторая половина бумажной аппликации (см. PaperArt.tsx): мотивы-знаки.
// Cluster — режимы (части, которые по очереди у руля); Leaf — рост, профиль,
// «готово»; Talk — разговор с человеком, терапевт; Beads — настройки;
// Check — задания и планы; Heart — «мне плохо», кризисный вход.
import type { ReactNode } from 'react';
import { PAPER, type ArtProps } from './paper';

function Svg({ size = 'square', viewBox, children }: ArtProps & { viewBox: string; children: ReactNode }) {
  return (
    <svg className={`pp-art pp-art--${size}`} viewBox={viewBox} aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

export function Cluster({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <circle cx="30" cy="36" r="22" fill={PAPER.slate} fillOpacity=".85" />
      <circle cx="66" cy="26" r="16" fill={PAPER.brown} />
      <circle cx="94" cy="40" r="12" fill={PAPER.clay} />
      <circle cx="70" cy="50" r="8" fill={PAPER.sage} />
    </Svg>
  );
}

export function Leaf({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <path d="M26 58 C 26 24, 56 8, 100 8 C 100 44, 70 60, 26 58 Z" fill={PAPER.moss} />
      <path d="M30 56 C 48 44, 70 30, 96 12" fill="none" stroke={PAPER.sage} strokeWidth="4" strokeLinecap="round" />
    </Svg>
  );
}

export function Talk({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <ellipse cx="46" cy="30" rx="34" ry="20" fill={PAPER.sage} />
      <path d="M26 46 L 20 58 L 40 48 Z" fill={PAPER.sage} />
      <ellipse cx="82" cy="36" rx="28" ry="17" fill={PAPER.clay} />
      <path d="M98 50 L 104 60 L 86 52 Z" fill={PAPER.clay} />
    </Svg>
  );
}

export function Beads({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <path d="M12 32 H108" stroke={PAPER.sage} strokeWidth="4" strokeLinecap="round" />
      <circle cx="28" cy="32" r="12" fill={PAPER.moss} />
      <circle cx="60" cy="32" r="9" fill={PAPER.brown} />
      <circle cx="90" cy="32" r="6" fill={PAPER.clay} />
    </Svg>
  );
}

export function Check({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <rect x="14" y="10" width="92" height="44" rx="10" fill={PAPER.sage} />
      <path d="M40 34 L 54 46 L 82 20" fill="none" stroke={PAPER.moss} strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function Heart({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <path d="M60 58 C 40 46, 20 36, 20 22 C 20 12, 30 6, 40 10 C 48 13, 56 20, 60 26 C 64 20, 72 13, 80 10 C 90 6, 100 12, 100 22 C 100 36, 80 46, 60 58 Z" fill={PAPER.clay} />
    </Svg>
  );
}

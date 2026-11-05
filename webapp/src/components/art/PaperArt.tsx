// Бумажная аппликация — картинки единого стиля сайта (референс владельца
// 2026-11-04, docs/design/PAPER_2026-11.md). Встроенный SVG, цвета только из
// токенов: внешних файлов нет (CSP 'self'), размытия нет (check-render-poison).
// Декор: aria-hidden, смысл несёт текст рядом. Размер задаёт класс
// .pp-art--hero / --square / --row / --empty (styles/paper.css).
// Мотив → смысл: Strokes — трекер и потребности; Ribbon — «Что случилось»;
// Pebbles — дневник; Cup — пусто и отдых; Breath — дыхание и «здесь и сейчас»;
// Sheets — записи и «Мой путь»; Layers — схемы и паттерны.
import type { ReactNode } from 'react';

/** Бумага референса: тёмная зелень, шалфей, тёмно-коричневый, терракота. */
export const PAPER = {
  moss: 'var(--c-moss)',
  sage: 'color-mix(in srgb, var(--c-moss) 55%, var(--bg))',
  brown: 'var(--text-sub)',
  clay: 'var(--c-clay)',
  slate: 'var(--c-slate)',
  amber: 'var(--c-amber)',
  plum: 'var(--c-plum)',
} as const;

export interface ArtProps { size?: 'hero' | 'square' | 'row' | 'empty' }

function Svg({ size = 'square', viewBox, children }: ArtProps & { viewBox: string; children: ReactNode }) {
  return (
    <svg className={`pp-art pp-art--${size}`} viewBox={viewBox} aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

export interface StrokeMark { id: string; dense: boolean }
const STROKE_PAPER = [PAPER.moss, PAPER.sage, PAPER.brown, PAPER.clay, PAPER.sage];
const STROKE_TILT = [-6, 3, -2, 5, -4];

/** Пять полосок цветной бумаги. `marks` — по одной на потребность: плотная или бледная. */
export function Strokes({ marks, size }: ArtProps & { marks?: StrokeMark[] }) {
  const list = marks ?? STROKE_PAPER.map((_, i) => ({ id: String(i), dense: true }));
  return (
    <Svg size={size} viewBox="0 0 120 100">
      {list.slice(0, 5).map((m, i) => (
        <rect
          key={m.id} data-need={m.id} data-rated={m.dense ? 'yes' : 'no'}
          x={8 + i * 22} y={m.dense ? 8 : 16} width="16" height={m.dense ? 84 : 72} rx="8"
          fill={STROKE_PAPER[i]} fillOpacity={m.dense ? 1 : 0.5}
          transform={`rotate(${STROKE_TILT[i]} ${16 + i * 22} 50)`}
        />
      ))}
    </Svg>
  );
}

/** Завиток ленты — момент, который зацепил и закрутился. */
export function Ribbon({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <path d="M8 46 C 18 18, 54 10, 66 30 C 76 48, 44 60, 36 42 C 28 24, 66 6, 112 26"
        fill="none" stroke={PAPER.clay} strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Три камешка — мысль, схема, спасибо. */
export function Pebbles({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <ellipse cx="24" cy="36" rx="20" ry="13" transform="rotate(-18 24 36)" fill={PAPER.moss} />
      <ellipse cx="60" cy="34" rx="20" ry="13" transform="rotate(-18 60 34)" fill={PAPER.brown} />
      <ellipse cx="96" cy="30" rx="20" ry="13" transform="rotate(-18 96 30)" fill={PAPER.clay} />
    </Svg>
  );
}

/** Чашка с паром — ничего не записано, и это нормально. */
export function Cup({ size = 'empty' }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 56 48">
      <path d="M10 22 H38 V32 A10 10 0 0 1 28 42 H20 A10 10 0 0 1 10 32 Z" fill="var(--paper-sunk)" stroke="var(--line-strong)" strokeWidth="1.5" />
      <path d="M38 26 H42 A5 5 0 0 1 42 36 H38" fill="none" stroke="var(--line-strong)" strokeWidth="1.5" />
      <path d="M19 16 C19 12 22 12 22 8 M27 16 C27 12 30 12 30 8" fill="none" stroke={PAPER.slate} strokeOpacity=".6" strokeWidth="1.5" strokeLinecap="round" />
    </Svg>
  );
}

/** Дыхание — две дуги, вдох и выдох. */
export function Breath({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <path d="M14 54 A46 46 0 0 1 106 54" fill="none" stroke={PAPER.sage} strokeWidth="12" strokeLinecap="round" />
      <path d="M34 54 A26 26 0 0 1 86 54" fill="none" stroke={PAPER.moss} strokeWidth="12" strokeLinecap="round" />
      <circle cx="60" cy="54" r="7" fill={PAPER.clay} />
    </Svg>
  );
}

/** Три листа бумаги веером — записи, то, что уже собрано. */
export function Sheets({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <rect x="22" y="10" width="40" height="50" rx="6" transform="rotate(-12 42 35)" fill={PAPER.sage} />
      <rect x="40" y="6" width="40" height="52" rx="6" transform="rotate(-4 60 32)" fill={PAPER.brown} />
      <rect x="58" y="8" width="40" height="52" rx="6" transform="rotate(6 78 34)" fill={PAPER.clay} />
    </Svg>
  );
}

/** Слои — схема под схемой, паттерны родом из детства. */
export function Layers({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <rect x="10" y="40" width="100" height="16" rx="8" fill={PAPER.sage} />
      <rect x="22" y="24" width="76" height="16" rx="8" fill={PAPER.moss} />
      <rect x="36" y="8" width="48" height="16" rx="8" fill={PAPER.clay} />
    </Svg>
  );
}

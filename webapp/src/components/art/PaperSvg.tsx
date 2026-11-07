import type { ReactNode } from 'react';
import type { ArtProps } from './paper';

/** Обёртка мотива: класс размера, aria-hidden (декор, смысл несёт текст рядом). */
export function PaperSvg({ size = 'square', viewBox, children }: ArtProps & { viewBox: string; children: ReactNode }) {
  return (
    <svg className={`pp-art pp-art--${size}`} viewBox={viewBox} aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

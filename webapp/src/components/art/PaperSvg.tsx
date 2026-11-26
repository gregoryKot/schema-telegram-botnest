import { useContext, type ReactNode } from 'react';
import { ArtFrameContext, type ArtProps } from './paper';

/** Обёртка мотива: класс размера, aria-hidden (декор, смысл несёт текст рядом). Внутри
 *  сцены (ArtFrameContext) — вложенный svg на месте рамки, размер задаёт рамка, а не класс. */
export function PaperSvg({ size = 'square', viewBox, children }: ArtProps & { viewBox: string; children: ReactNode }) {
  const frame = useContext(ArtFrameContext);
  if (frame) {
    return (
      <svg className="pp-art" x={frame.x} y={frame.y} width={frame.w} height={frame.h} viewBox={viewBox} aria-hidden="true" focusable="false">
        {children}
      </svg>
    );
  }
  return (
    <svg className={`pp-art pp-art--${size}`} viewBox={viewBox} aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

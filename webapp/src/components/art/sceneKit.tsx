// Каркас сцен — крупных картинок лендинга и мини-тестов (docs/design/PAPER_2026-11.md,
// «Сцены»). Тот же язык знаков, что у мелких мотивов, только крупно и с глубиной:
//  • подложка — пятно цветной бумаги с вырезанным краем (оттенок --h), рядом
//    клочок второй бумаги (--h2);
//  • глубина — сплошной слой цвета подложки, сдвинутый вниз-вправо (`Lift`):
//    так лежит бумага на бумаге. Размытия нет (check-render-poison).
// Декор: aria-hidden, смысл несёт текст рядом. Цвета — scenePaper.ts.
import type { CSSProperties, ReactNode } from 'react';
import { SCENE_BOX } from './scenePaper';
import '../../styles/paper-scenes.css';

/** Пятна с вырезанным краем: у каждой сцены своё, чтобы соседние не повторялись. */
const BLOB = {
  a: 'M48 70 C78 24 170 10 236 30 C296 48 316 112 300 170 C284 226 210 252 140 248 C70 244 18 206 14 146 C12 112 26 92 48 70 Z',
  b: 'M62 46 C120 14 220 18 270 56 C314 90 312 160 282 204 C250 248 168 258 104 238 C44 220 8 170 18 116 C26 82 40 60 62 46 Z',
  c: 'M34 96 C46 44 120 16 190 22 C262 28 310 72 306 134 C302 196 256 244 180 250 C100 256 36 222 24 168 C18 142 28 118 34 96 Z',
} as const;
/** Клочок второй бумаги: сверху справа или снизу слева. */
const PATCH = {
  tr: 'M236 14 C266 4 304 18 310 50 C316 82 288 100 258 94 C228 88 210 64 214 40 C216 28 224 18 236 14 Z',
  bl: 'M18 186 C28 160 64 154 88 170 C112 186 108 222 82 236 C56 250 20 240 12 216 C8 202 12 194 18 186 Z',
} as const;

export type BlobShape = keyof typeof BLOB;

interface SceneProps {
  /** Оттенок подложки и тени (oklch hue, как --h у pp-paper). */
  hue: number;
  /** Оттенок клочка второй бумаги; без него клочка нет. */
  patch?: number;
  patchAt?: keyof typeof PATCH;
  /** Форма пятна; null — без пятна (сцена лежит на цветной карточке). */
  blob?: BlobShape | null;
  className?: string;
  children: ReactNode;
}

export function SceneSvg({ hue, patch, patchAt = 'tr', blob = 'a', className, children }: SceneProps) {
  const style = { '--h': hue, '--h2': patch ?? hue } as CSSProperties;
  return (
    <svg className={`scn${className ? ` ${className}` : ''}`} viewBox={SCENE_BOX} style={style} aria-hidden="true" focusable="false">
      {patch !== undefined && <path className="scn-patch" d={PATCH[patchAt]} />}
      {blob && <path className="scn-blob" d={BLOB[blob]} />}
      {children}
    </svg>
  );
}

/** Фигуры, приподнятые над подложкой: их копия цветом тени лежит со сдвигом под ними. */
export function Lift({ children, by = 5 }: { children: ReactNode; by?: number }) {
  return (
    <>
      <g className="scn-shade" transform={`translate(${by} ${by + 1})`}>{children}</g>
      {children}
    </>
  );
}

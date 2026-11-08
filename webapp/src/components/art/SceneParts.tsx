// Детали сцен лендинга, которые не помещаются в общий холст 320×260 (sceneKit.tsx):
//  • SignScene — знак кабинета (PaperArt*, NeedArt) крупно, с тенью-вырезкой: под ним
//    тот же знак тоном глубже бумаги, со сдвигом (.scn-sign, paper-scenes.css). Знак
//    не перерисовывается — «один мотив на сущность» (docs/design/PAPER_2026-11.md).
//  • FinalCorners — углы финального листа «Первый шаг — просто заметить»: снизу слева из
//    края листа поднимаются три полоски-потребности, сверху справа — лист растения и
//    камешек: заметили, записали, растёт. Полоски уходят за край — лист их обрезает.
// Декор: aria-hidden, смысл несёт текст рядом.
import type { CSSProperties, ReactElement } from 'react';
import type { ArtProps } from './paper';
import { INK } from './scenePaper';
import { Lift } from './sceneKit';

export function SignScene({ Art, className }: { Art: (p: ArtProps) => ReactElement; className?: string }) {
  return (
    <span className={`scn-sign${className ? ` ${className}` : ''}`} aria-hidden="true">
      <Art size="hero" />
      <Art size="hero" />
    </span>
  );
}

const RISE = [
  { x: 30, y: 52, h: 170, deg: -8, fill: INK.teal },
  { x: 82, y: 16, h: 206, deg: 4, fill: INK.moss },
  { x: 134, y: 76, h: 146, deg: 10, fill: INK.plum },
];

export function FinalCorners({ hue = 55 }: { hue?: number }) {
  const svg = { className: 'scn', 'aria-hidden': true, focusable: false, style: { '--h': hue } as CSSProperties } as const;
  return (
    <>
      <svg {...svg} className="scn pl2-final-corner pl2-final-corner--a" viewBox="0 0 200 180">
        <Lift by={6}>
          {RISE.map((r) => (
            <rect key={r.x} x={r.x} y={r.y} width="34" height={r.h} rx="17" fill={r.fill} transform={`rotate(${r.deg} ${r.x + 17} 200)`} />
          ))}
        </Lift>
      </svg>
      <svg {...svg} className="scn pl2-final-corner pl2-final-corner--b" viewBox="0 0 200 160">
        <Lift by={6}>
          <path d="M40 120 C 40 66, 88 30, 170 26 C 170 92, 116 124, 40 120 Z" fill={INK.moss} />
          <ellipse cx="66" cy="136" rx="26" ry="17" transform="rotate(-16 66 136)" fill={INK.clay} />
        </Lift>
        <path d="M48 114 C 82 90, 120 62, 162 32" fill="none" stroke={INK.sage} strokeWidth="5" strokeLinecap="round" />
      </svg>
    </>
  );
}

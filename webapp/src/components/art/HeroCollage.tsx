// Коллаж первого экрана лендинга — подложка под мокапом «Сегодня» (AppPreview).
// Заголовок спрашивает «почему со мной снова это происходит?», и картинка отвечает
// языком знаков (docs/design/PAPER_2026-11.md): лента-петля проходит за телефоном —
// сценарий, который закручивается снова и снова; пять полосок на земле — потребности,
// за которыми следит чек-ин; лист — то, что вырастает, когда петлю замечают.
// Пятно персика и клочки шалфея и неба — цветная бумага (styles/paper-scenes.css).
import type { CSSProperties } from 'react';
import { INK } from './scenePaper';
import { Lift } from './sceneKit';

const STROKES = [
  { x: 446, h: 62, fill: INK.moss, deg: -6 },
  { x: 470, h: 80, fill: INK.amber, deg: 3 },
  { x: 494, h: 52, fill: INK.clay, deg: -3 },
  { x: 518, h: 72, fill: INK.slate, deg: 5 },
];

export function HeroCollage() {
  const ribbon = { fill: 'none', stroke: INK.clay, strokeWidth: 18, strokeLinecap: 'round' } as const;
  return (
    <svg className="scn pl2-hero-collage" viewBox="0 0 580 520" style={{ '--h': 45, '--h2': 135 } as CSSProperties} aria-hidden="true" focusable="false">
      <path className="scn-blob" d="M84 120 C130 38 278 8 400 30 C520 52 578 160 560 280 C542 400 446 500 300 500 C160 500 46 440 26 316 C14 232 44 176 84 120 Z" />
      <path className="scn-patch" d="M22 360 C40 316 104 304 140 336 C176 368 166 432 122 456 C78 480 20 462 8 420 C2 398 10 378 22 360 Z" />
      <path className="scn-patch scn-patch--sky" d="M430 26 C470 4 534 18 548 62 C562 106 520 132 478 124 C436 116 404 86 410 56 C412 42 418 32 430 26 Z" />
      <Lift by={6}>
        <path d="M14 236 C64 196 132 196 150 246 C166 292 112 318 92 286 C72 254 120 208 200 196" {...ribbon} />
        <path d="M400 300 C452 288 494 300 502 330 C510 362 472 376 462 352 C452 328 500 300 562 308" {...ribbon} />
        <path d="M404 486 H566" stroke={INK.sage} strokeWidth="7" strokeLinecap="round" />
        {STROKES.map((s) => (
          <rect key={s.x} x={s.x} y={480 - s.h} width="18" height={s.h} rx="9" fill={s.fill} transform={`rotate(${s.deg} ${s.x + 9} 480)`} />
        ))}
        <path d="M60 472 C52 438 70 410 104 402 C110 436 94 462 60 472 Z" fill={INK.moss} />
      </Lift>
    </svg>
  );
}

// Коллаж первого экрана лендинга — подложка под мокапом «Сегодня» (AppPreview).
// Заголовок спрашивает «почему со мной снова это происходит?», и картинка отвечает
// языком знаков (docs/design/PAPER_2026-11.md): лента-петля уходит за телефон —
// сценарий, который закручивается снова и снова; полоски на земле — потребности,
// за которыми следит чек-ин; лист — то, что вырастает, когда петлю замечают.
// Подложка — вырезанные листы цветной бумаги (персик, небо, шалфей), не пятна.
// Два холста: широкий (компьютер, планшет) и узкий — телефон, где коллаж целиком
// лежит в ширине контента: телефон-мокап на листе, по углам квадратики бумаги,
// петля внизу. Какой виден — решает CSS (.pl2-hero-collage--*, product-landing-hero.css).
// `compact` — третий холст 320×140 без телефона для кабинета (шапка приветствия первого
// входа): тот же образ, лендинговых классов у него нет.
import type { CSSProperties, ReactNode } from 'react';
import { INK } from './scenePaper';
import { Lift } from './sceneKit';

const STROKES = [
  { x: 452, h: 62, fill: INK.moss, deg: -6 },
  { x: 476, h: 80, fill: INK.amber, deg: 3 },
  { x: 500, h: 52, fill: INK.clay, deg: -3 },
  { x: 524, h: 72, fill: INK.slate, deg: 5 },
];
const ribbon = { fill: 'none', stroke: INK.clay, strokeWidth: 18, strokeLinecap: 'round' } as const;

/** Вырезанный лист: нижний слой тоном глубже со сдвигом, верхний — бумага (.hc-*). */
function Cut({ cls, x, y, w, h, deg, rx = 26 }: { cls: string; x: number; y: number; w: number; h: number; deg: number; rx?: number }) {
  const turn = `rotate(${deg} ${x + w / 2} ${y + h / 2})`;
  return (
    <>
      <rect className={`${cls} hc-under`} x={x + 8} y={y + 9} width={w} height={h} rx={rx} transform={turn} />
      <rect className={cls} x={x} y={y} width={w} height={h} rx={rx} transform={turn} />
    </>
  );
}

function Canvas({ cls, box, children }: { cls: string; box: string; children: ReactNode }) {
  const style = { '--h': 45, '--h2': 135 } as CSSProperties;
  return (
    <svg className={`scn ${cls}`} viewBox={box} style={style} aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

/** Полоски компактного коллажа на земле (низ на y = 110). */
const COMPACT_STROKES = [
  { x: 186, h: 40, fill: INK.moss, deg: -6 },
  { x: 202, h: 54, fill: INK.amber, deg: 3 },
  { x: 218, h: 32, fill: INK.clay, deg: -3 },
  { x: 234, h: 46, fill: INK.slate, deg: 5 },
];

/** Компактный коллаж 320×140 без телефона — шапка-лист первого входа (приветствие):
 *  тот же образ первого экрана лендинга — петля, полоски на земле, лист. */
function HeroCollageCompact() {
  return (
    <Canvas cls="hc-compact" box="0 0 320 140">
      <Cut cls="hc-sky" x={236} y={2} w={74} h={54} deg={8} rx={14} />
      <Cut cls="hc-sage" x={6} y={84} w={72} h={48} deg={-8} rx={14} />
      <Cut cls="hc-peach" x={18} y={12} w={276} h={112} deg={-2} rx={22} />
      <Lift by={4}>
        <path d="M40 92 C58 62 92 58 100 80 C107 100 82 110 74 96 C66 82 90 58 132 56" {...ribbon} strokeWidth={11} />
        <path d="M168 112 H282" stroke={INK.sage} strokeWidth="5" strokeLinecap="round" />
        {COMPACT_STROKES.map((s) => (
          <rect key={s.x} x={s.x} y={110 - s.h} width="12" height={s.h} rx="6" fill={s.fill} transform={`rotate(${s.deg} ${s.x + 6} 110)`} />
        ))}
        <path d="M258 110 C252 88 264 68 286 64 C290 86 280 104 258 110 Z" fill={INK.moss} />
      </Lift>
    </Canvas>
  );
}

/** Коллаж первого экрана: широкий и узкий холст (какой виден — решает CSS); `compact` — 320×140 без телефона. */
export function HeroCollage({ compact = false }: { compact?: boolean }) {
  if (compact) return <HeroCollageCompact />;
  return (
    <>
      <Canvas cls="pl2-hero-collage pl2-hero-collage--wide" box="0 0 580 520">
        <Cut cls="hc-sky" x={420} y={22} w={140} h={120} deg={8} rx={22} />
        <Cut cls="hc-sage" x={20} y={330} w={150} h={140} deg={-9} rx={22} />
        <Cut cls="hc-peach" x={64} y={40} w={452} h={440} deg={-4} rx={36} />
        <Lift by={6}>
          <path d="M14 236 C64 196 132 196 150 246 C166 292 112 318 92 286 C72 254 120 208 200 196" {...ribbon} />
          <path d="M410 488 H566" stroke={INK.sage} strokeWidth="7" strokeLinecap="round" />
          {STROKES.map((s) => (
            <rect key={s.x} x={s.x} y={482 - s.h} width="18" height={s.h} rx="9" fill={s.fill} transform={`rotate(${s.deg} ${s.x + 9} 482)`} />
          ))}
          <path d="M58 462 C50 428 68 400 102 392 C108 426 92 452 58 462 Z" fill={INK.moss} />
        </Lift>
      </Canvas>
      <Canvas cls="pl2-hero-collage pl2-hero-collage--narrow" box="0 0 358 520">
        <Cut cls="hc-sky" x={258} y={4} w={88} h={76} deg={8} rx={16} />
        <Cut cls="hc-sage" x={10} y={430} w={92} h={80} deg={-7} rx={16} />
        <Cut cls="hc-peach" x={18} y={24} w={314} h={466} deg={-2} rx={28} />
        <Lift by={5}>
          <path d="M226 506 C250 478 296 480 300 500 C303 516 276 517 272 503 C268 489 300 478 342 486" {...ribbon} strokeWidth={13} />
        </Lift>
      </Canvas>
    </>
  );
}

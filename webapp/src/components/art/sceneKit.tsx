// Каркас сцен — крупных картинок лендинга и мини-тестов (docs/design/PAPER_2026-11.md,
// «Сцены»). Тот же язык знаков, что у мелких мотивов, только крупно и с глубиной:
//  • подложка — вырезанный лист цветной бумаги (оттенок --h), чуть повёрнутый, под ним
//    второй лист тоном глубже; рядом квадратик второй бумаги (--h2). Пятен-клякс нет:
//    владелец и судьи 2026-11 — «амёбы» читались детсадом, лист — бумагой;
//  • глубина — сплошной слой цвета подложки, сдвинутый вниз-вправо (`Lift`):
//    так лежит бумага на бумаге. Размытия нет (check-render-poison).
// Всё лежит внутри холста 320×260 с равными полями слева и справа (сдвинутый слой
// тоже): на телефоне сцена не режется краем экрана. Декор: aria-hidden, смысл несёт
// текст рядом. Цвета — scenePaper.ts.
import type { CSSProperties, ReactNode } from 'react';
import { SCENE_BOX } from './scenePaper';
import '../../styles/paper-scenes.css';

/** Сдвиг нижнего листа под подложкой (единицы холста). */
const UNDER = { x: 8, y: 9 } as const;
/** Листы-подложки: у каждой сцены свой наклон и пропорция, чтобы соседние не повторялись.
 *  x = (320 − w − UNDER.x) / 2 — поля слева и справа равны вместе с нижним листом. */
const SHEET = {
  a: { x: 18, y: 14, w: 276, h: 222, deg: -3 },
  b: { x: 22, y: 11, w: 268, h: 228, deg: 2.5 },
  c: { x: 16, y: 18, w: 280, h: 214, deg: -1.5 },
} as const;
/** Квадратик второй бумаги: выглядывает из-под листа сверху справа или снизу слева. */
const PATCH = {
  tr: { x: 226, y: 4, s: 78, deg: 9 },
  bl: { x: 14, y: 172, s: 76, deg: -8 },
} as const;

type SheetShape = keyof typeof SHEET;

interface SceneProps {
  /** Оттенок подложки и тени (oklch hue, как --h у pp-paper). */
  hue: number;
  /** Оттенок квадратика второй бумаги; без него квадратика нет. */
  patch?: number;
  patchAt?: keyof typeof PATCH;
  /** Форма листа-подложки; null — без листа (сцена лежит на цветной плитке). */
  sheet?: SheetShape | null;
  /** Окно холста вместо 320×260 — только у сцены без листа: рамка по самим фигурам. */
  box?: string;
  className?: string;
  children: ReactNode;
}

/** Лист бумаги со вторым листом под ним (сдвиг UNDER) — классы задают тон. */
function Sheet({ x, y, w, h, deg, rx, cls }: { x: number; y: number; w: number; h: number; deg: number; rx: number; cls: string }) {
  const turn = `rotate(${deg} ${x + w / 2} ${y + h / 2})`;
  return (
    <>
      <rect className={`${cls}-under`} x={x + UNDER.x} y={y + UNDER.y} width={w} height={h} rx={rx} transform={turn} />
      <rect className={cls} x={x} y={y} width={w} height={h} rx={rx} transform={turn} />
    </>
  );
}

export function SceneSvg({ hue, patch, patchAt = 'tr', sheet = 'a', box = SCENE_BOX, className, children }: SceneProps) {
  const style = { '--h': hue, '--h2': patch ?? hue } as CSSProperties;
  const p = PATCH[patchAt];
  return (
    <svg className={`scn${className ? ` ${className}` : ''}`} viewBox={sheet ? SCENE_BOX : box} style={style} aria-hidden="true" focusable="false">
      {patch !== undefined && <Sheet x={p.x} y={p.y} w={p.s} h={p.s} deg={p.deg} rx={14} cls="scn-patch" />}
      {sheet && <Sheet {...SHEET[sheet]} rx={26} cls="scn-sheet" />}
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

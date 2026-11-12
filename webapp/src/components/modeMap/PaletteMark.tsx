// Маленькие знаки фигур палитры холста — тот же язык бумажной аппликации, что у
// знаков групп (docs/design/PAPER_2026-11.md). Строка режима и схемы каталога берёт знак группы
// и домена (PaletteRow); здесь — фигуры: схема — два слоя, триггер — лента (момент, который зацепил),
// поведение — ступени (что человек делает дальше), опыт детства — полоска пригнулась
// (что с потребностью случилось), потребность — полоска, круг потребностей — пять
// полосок по кругу. Плоская бумага без обводки; цвет — цвет фигуры на холсте.
import type { ReactElement } from 'react';
import type { MarkKind } from './paletteModel';

const pale = (c: string) => `color-mix(in srgb, ${c} 45%, var(--bg))`;

const SHAPES: Record<Exclude<MarkKind, 'mode'>, (c: string) => ReactElement> = {
  schema: (c) => (
    <>
      <rect x="2.5" y="10.5" width="15" height="5.5" rx="2.75" fill={c} />
      <rect x="5.5" y="4.5" width="9" height="5.5" rx="2.75" fill={pale(c)} />
    </>
  ),
  trigger: (c) => (
    <path d="M2.8 14 C 4 6.5, 10 4.5, 11.5 8.5 C 13 12.5, 7.6 14.2, 7.6 10.6 C 7.6 7, 13 5, 17.2 7.2"
      fill="none" stroke={c} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
  ),
  behavior: (c) => <path d="M2.5 17 V13 Q2.5 12.5 3 12.5 H7 V9 Q7 8.5 7.5 8.5 H11.5 V5 Q11.5 4.5 12 4.5 H17 Q17.5 4.5 17.5 5 V17 Z" fill={c} />,
  origin: (c) => (
    <>
      <rect x="3" y="15.5" width="14" height="2" rx="1" fill={pale(c)} />
      <rect x="8.2" y="3.5" width="4.6" height="12.5" rx="2.3" fill={c} transform="rotate(-30 10.5 16)" />
    </>
  ),
  need: (c) => (
    <>
      <rect x="3" y="15.5" width="14" height="2" rx="1" fill={pale(c)} />
      <rect x="7.7" y="3" width="4.6" height="13" rx="2.3" fill={c} />
    </>
  ),
  needs: (c) => (
    <>
      {[0, 72, 144, 216, 288].map((deg) => (
        <rect key={deg} x="8.6" y="1.2" width="2.8" height="5.2" rx="1.4" fill={c} transform={`rotate(${deg} 10 10)`} />
      ))}
      <circle cx="10" cy="10" r="2.4" fill={pale(c)} />
    </>
  ),
};

/** Знак строки палитры по виду фигуры; размер задаёт CSS (.mm2-mark), смысл несёт подпись рядом. */
export function PaletteMark({ kind, color }: { kind: Exclude<MarkKind, 'mode'>; color: string }) {
  return (
    <svg className="mm2-mark" viewBox="0 0 20 20" aria-hidden="true" focusable="false" data-mark={kind}>
      {SHAPES[kind](color)}
    </svg>
  );
}

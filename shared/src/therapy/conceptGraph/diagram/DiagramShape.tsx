import {
  CRITIC_PATH,
  PENTA_PATH,
  SHIELD_PATH,
  scalePath,
} from '../../../modeMap/modeShapes';
import { shapePaint } from './diagramPaper';
import type { DiagramShape as Shape } from './diagramTypes';

const ROUNDED_RADIUS = 14;

/** Контуры из карты режимов; все живут в пространстве 100×100. */
const PATHS: Partial<Record<Shape, string>> = {
  octagon: CRITIC_PATH,
  pentagon: PENTA_PATH,
  shield: SHIELD_PATH,
};

/**
 * Фигура в пикселях своего бокса. Контур рисуется 1:1 в пикселях, а не
 * растягивается через viewBox: обводка одной толщины со всех сторон при любом
 * соотношении сторон, как на холсте карты режимов.
 */
export function DiagramShapeSvg({
  shape,
  w,
  h,
  hue,
  top,
  open,
  faint,
  ghost,
}: {
  shape: Shape;
  w: number;
  h: number;
  /** Оттенок бумаги фигуры (nodeHue); без него — нейтральная бумага. */
  hue?: number;
  /** Отступ сверху: бокс кнопки выше фигуры, чтобы зона нажатия была не меньше 44. */
  top: number;
  open?: boolean;
  /** Режим или схема без связей: контур бледнее. */
  faint?: boolean;
  /** Заготовка пустой секции: тихая бумага без контура. */
  ghost?: boolean;
}) {
  const common = {
    ...shapePaint(hue, faint),
    strokeWidth: ghost ? 0 : open ? 3 : 1.5,
    strokeLinejoin: 'round' as const,
  };
  const path = PATHS[shape];
  return (
    <svg
      aria-hidden="true"
      width={w}
      height={h}
      style={{ position: 'absolute', left: 0, top, overflow: 'visible' }}
    >
      {shape === 'ellipse' && (
        <ellipse cx={w / 2} cy={h / 2} rx={w / 2} ry={h / 2} {...common} />
      )}
      {(shape === 'pill' || shape === 'rounded') && (
        <rect
          width={w}
          height={h}
          rx={shape === 'pill' ? h / 2 : ROUNDED_RADIUS}
          {...common}
        />
      )}
      {path && <path d={scalePath(path, w / 100, h / 100)} {...common} />}
    </svg>
  );
}

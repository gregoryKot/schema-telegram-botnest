// Арифметика раскладки HUD без Phaser и DOM: её гоняет vitest под node (Phaser там не импортируется).

/** Зазор от края кадра до пузыря реплики, в координатах игры. */
export const BUBBLE_EDGE = 6;
const MENU_GAP = 10;

/** Левый край и ширина в пикселях окна — всё, что нужно от getBoundingClientRect. */
export interface ScreenSpan {
  left: number;
  width: number;
}

/**
 * Центр пузыря шириной width над точкой x, но целиком в кадре шириной frameW.
 * Порядок min/max как у Phaser.Math.Clamp: пузырь шире кадра прижат левым краем — начало реплики читается.
 */
export function clampBubbleX(x: number, width: number, frameW: number): number {
  const hw = width / 2 + BUBBLE_EDGE;
  return Math.max(hw, Math.min(frameW - hw, x));
}

/**
 * Правый край HUD в координатах игры левее HTML-кнопки меню: кнопка стоит в пикселях окна,
 * а холст масштабируется. Нет кнопки или она скрыта — отступ margin от правого края кадра.
 */
export function hudRightEdge(menu: ScreenSpan | undefined, canvas: ScreenSpan, frameW: number, margin: number): number {
  if (!menu || !canvas.width || menu.width === 0) return frameW - margin;
  const menuLeft = ((menu.left - canvas.left) * frameW) / canvas.width;
  return Math.min(frameW - margin, menuLeft - MENU_GAP);
}

export interface AnchorBox { left: number; top: number; bottom: number }
export interface MenuSize { width: number; height: number }

const MARGIN = 8;
const GAP = 4;

/** Место меню у якоря: под ним, прижато к краям экрана; не влезает вниз — над якорем, не влезает и туда — к нижнему краю. */
export function placeMenu(anchor: AnchorBox, menu: MenuSize, viewport: MenuSize): { left: number; top: number } {
  const left = Math.max(MARGIN, Math.min(anchor.left, viewport.width - MARGIN - menu.width));
  const below = anchor.bottom + GAP;
  if (below + menu.height <= viewport.height - MARGIN) return { left, top: below };
  const above = anchor.top - GAP - menu.height;
  return { left, top: above >= MARGIN ? above : Math.max(MARGIN, viewport.height - MARGIN - menu.height) };
}

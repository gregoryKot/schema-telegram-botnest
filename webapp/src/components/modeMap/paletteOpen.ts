/** Уже этой ширины окна палитра холста открывается свёрнутой: рядом с меню кабинета холсту не остаётся места. */
export const PALETTE_WIDE_FROM = 1100;

/**
 * Раскрыта ли палитра холста при открытии карты. На широком окне — как терапевт оставил
 * (`saved` из localStorage: '0' — свернул; пусто — раскрыта). На узком (планшет) — всегда свёрнута:
 * 240px палитры при 768 оставляли холсту меньше трети экрана; раскрывается «ушком» на время работы.
 */
export function paletteOpenInitial(saved: string | null, width: number): boolean {
  if (width < PALETTE_WIDE_FROM) return false;
  return saved !== '0';
}

// Полоса вкладок карточки клиента (b30): маска у края, за которым есть вкладки (is-fade-start / is-fade-end,
// therapist-card.css), и прокрутка активной к центру. Чистые функции — здесь, эффект — useTabsBar.ts.

/** Допуск в пикселях: дробная прокрутка на экранах с dpr 2–3 не доходит до края ровно. */
const EDGE = 2;

export interface TabsFade { start: boolean; end: boolean }

/** С какой стороны за краем полосы остались вкладки. */
export function tabsFade(scrollLeft: number, scrollWidth: number, clientWidth: number): TabsFade {
  if (scrollWidth - clientWidth <= EDGE) return { start: false, end: false };
  return { start: scrollLeft > EDGE, end: scrollLeft + clientWidth < scrollWidth - EDGE };
}

/** Прокрутка полосы, при которой вкладка (offsetLeft, ширина) стоит по центру; в пределах [0, max]. */
export function tabScrollTarget(tabLeft: number, tabWidth: number, clientWidth: number, scrollWidth: number): number {
  const max = Math.max(0, scrollWidth - clientWidth);
  const centered = tabLeft + tabWidth / 2 - clientWidth / 2;
  return Math.round(Math.min(max, Math.max(0, centered)));
}

/** Классы полосы по маске: пробел в начале, если есть хоть один. */
export function fadeClass({ start, end }: TabsFade): string {
  return `${start ? ' is-fade-start' : ''}${end ? ' is-fade-end' : ''}`;
}
/** Содержимое полосы выросло или сжалось больше допуска — снова к активной (эффект отработал до счётчиков и шрифта). */
export const widthChanged = (prev: number, next: number): boolean => Math.abs(next - prev) > EDGE;

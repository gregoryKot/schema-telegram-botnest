// Полоса вкладок карточки клиента (b30): маска у края, за которым есть вкладки (is-fade-start / is-fade-end,
// therapist-card.css), и прокрутка активной: видимая стоит, скрытая — к центру. Чистые функции — здесь, эффект — useTabsBar.ts.

/** Допуск в пикселях: дробная прокрутка на экранах с dpr 2–3 не доходит до края ровно. */
const EDGE = 2;

export interface TabsFade { start: boolean; end: boolean }

/** С какой стороны за краем полосы остались вкладки. */
export function tabsFade(scrollLeft: number, scrollWidth: number, clientWidth: number): TabsFade {
  if (scrollWidth - clientWidth <= EDGE) return { start: false, end: false };
  return { start: scrollLeft > EDGE, end: scrollLeft + clientWidth < scrollWidth - EDGE };
}

/** Ширина маски у края — та же, что --tk-fade в therapist-card.css (сверка — clientTabsScroll.test.ts). */
export const TAB_FADE = 40;

/** Прокрутка полосы для активной вкладки: уже видна целиком (не под маской) — полоса стоит (b34: на 768 лента
 *  прыгала вбок при каждом переходе); иначе — по центру, в пределах [0, max]. Без `current` — всегда по центру. */
export function tabScrollTarget(tabLeft: number, tabWidth: number, clientWidth: number, scrollWidth: number, current?: number): number {
  const max = Math.max(0, scrollWidth - clientWidth);
  if (current != null) {
    const fade = tabsFade(current, scrollWidth, clientWidth);
    const from = current + (fade.start ? TAB_FADE : 0);
    const to = current + clientWidth - (fade.end ? TAB_FADE : 0);
    if (tabLeft >= from && tabLeft + tabWidth <= to) return Math.min(max, Math.max(0, current));
  }
  const centered = tabLeft + tabWidth / 2 - clientWidth / 2;
  return Math.round(Math.min(max, Math.max(0, centered)));
}

/** Классы полосы по маске: пробел в начале, если есть хоть один. */
export function fadeClass({ start, end }: TabsFade): string {
  return `${start ? ' is-fade-start' : ''}${end ? ' is-fade-end' : ''}`;
}
/** Содержимое полосы выросло или сжалось больше допуска — снова к активной (эффект отработал до счётчиков и шрифта). */
export const widthChanged = (prev: number, next: number): boolean => Math.abs(next - prev) > EDGE;

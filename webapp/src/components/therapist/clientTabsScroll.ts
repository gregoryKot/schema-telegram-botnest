// Полоса вкладок карточки клиента (ClientTabs, b30): на 390 вкладки уходят за правый край. Признак прокрутки —
// маска-градиент у края, за которым есть ещё вкладки (классы is-fade-start / is-fade-end, therapist-card.css);
// при открытии и смене вкладки полоса сама встаёт так, чтобы активная была по центру. Чистые функции — здесь,
// эффект — в ClientTabs.tsx. Прокрутка — scrollLeft самой полосы: scrollIntoView двигал и предков (страницу).

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

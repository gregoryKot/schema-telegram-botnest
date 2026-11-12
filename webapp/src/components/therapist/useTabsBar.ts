// Вкладки карточки (b30) и фильтр «Записей» (r1): активная — по центру (scrollLeft полосы, не scrollIntoView), маска у
// края; полоса выросла после эффекта (счётчики, шрифт) — ResizeObserver снова к активной (r1, L1). Расчёты — clientTabsScroll.ts.
import { useCallback, useEffect, useRef, useState } from 'react';
import { fadeClass, tabScrollTarget, tabsFade, widthChanged, type TabsFade } from './clientTabsScroll';

export function useTabsBar(active: string) {
  const ref = useRef<HTMLDivElement>(null);
  const lastWidth = useRef(0);
  const [fade, setFade] = useState<TabsFade>({ start: false, end: false });
  const onScroll = useCallback(() => {
    const el = ref.current; if (!el) return;
    const next = tabsFade(el.scrollLeft, el.scrollWidth, el.clientWidth);
    setFade(prev => (prev.start === next.start && prev.end === next.end ? prev : next));
  }, []);
  const center = useCallback(() => {
    const el = ref.current;
    const tab = el?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (el && tab) el.scrollLeft = tabScrollTarget(tab.offsetLeft, tab.offsetWidth, el.clientWidth, el.scrollWidth);
    if (el) lastWidth.current = el.scrollWidth;
    onScroll();
  }, [onScroll]);
  useEffect(() => { center(); }, [active, center]);
  useEffect(() => {
    const el = ref.current; if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => (widthChanged(lastWidth.current, el.scrollWidth) ? center() : onScroll()));
    for (const node of [el, ...Array.from(el.children)]) ro.observe(node);
    return () => ro.disconnect();
  }, [center, onScroll]);
  return { ref, onScroll, fadeClassName: fadeClass(fade) };
}

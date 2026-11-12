// Эффект полосы вкладок карточки клиента (b30): активная вкладка — по центру полосы при открытии и смене,
// маска у края, за которым есть ещё вкладки. Расчёты — clientTabsScroll.ts (чистые функции с тестом).
import { useCallback, useEffect, useRef, useState } from 'react';
import { fadeClass, tabScrollTarget, tabsFade, type TabsFade } from './clientTabsScroll';

const NO_FADE: TabsFade = { start: false, end: false };

/** `active` — ключ активной вкладки: его смена прокручивает полосу. Возвращает ref, onScroll и классы маски. */
export function useTabsBar(active: string) {
  const ref = useRef<HTMLDivElement>(null);
  const [fade, setFade] = useState<TabsFade>(NO_FADE);
  const onScroll = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const next = tabsFade(el.scrollLeft, el.scrollWidth, el.clientWidth);
    setFade(prev => (prev.start === next.start && prev.end === next.end ? prev : next));
  }, []);
  // Переход кнопкой («+ Заметка», «Запросить тест на схемы») меняет вкладку мимо полосы: активная уезжала
  // за край и не была видна (QA 2026-11, T-11). Прокручивается сама полоса — scrollIntoView двигал и страницу.
  useEffect(() => {
    const el = ref.current;
    const tab = el?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (el && tab) el.scrollLeft = tabScrollTarget(tab.offsetLeft, tab.offsetWidth, el.clientWidth, el.scrollWidth);
    onScroll();
  }, [active, onScroll]);
  useEffect(() => {
    window.addEventListener('resize', onScroll);
    return () => window.removeEventListener('resize', onScroll);
  }, [onScroll]);
  return { ref, onScroll, fadeClassName: fadeClass(fade) };
}

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { SubView } from './SubViews';

/**
 * Какой вид листа настроек открыт и куда вернуться из подэкрана. Главный вид на время подэкрана
 * размонтируется, поэтому при открытии запоминаем место прокрутки и строку-открывашку
 * (`data-opens` у SRow), а при возврате — до отрисовки кадра — ставим прокрутку на место и
 * возвращаем фокус на ту же строку (иначе лист открывался с начала, а фокус падал в body).
 */
export function useSubViewNav() {
  const [view, setView] = useState<SubView>('main');
  const scrollRef = useRef<HTMLDivElement>(null);
  const saved = useRef<{ top: number; from: SubView } | null>(null);

  const open = useCallback((next: SubView) => {
    saved.current = { top: scrollRef.current?.scrollTop ?? 0, from: next };
    setView(next);
  }, []);
  const close = useCallback(() => setView('main'), []);

  useLayoutEffect(() => {
    const back = saved.current;
    const box = scrollRef.current;
    if (view !== 'main' || !back || !box) return;
    saved.current = null;
    box.scrollTop = back.top;
    box.querySelector<HTMLElement>(`[data-opens="${back.from}"]`)?.focus({ preventScroll: true });
  }, [view]);

  return { view, open, close, scrollRef };
}

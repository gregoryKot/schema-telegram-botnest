import { useCallback, useEffect, useRef } from 'react';
import { AUTO_ADVANCE_MS } from './trackerFlow';

/** Отложенный автопереход: новый вызов заменяет ожидающий, `cancel` и размонтирование его снимают. */
export function useAutoAdvance() {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancel = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);
  useEffect(() => cancel, [cancel]);
  const schedule = useCallback((fn: () => void) => {
    cancel();
    timer.current = setTimeout(fn, AUTO_ADVANCE_MS);
  }, [cancel]);
  return { schedule, cancel };
}

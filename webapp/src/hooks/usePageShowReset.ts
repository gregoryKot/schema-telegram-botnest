import { useEffect, useRef } from 'react';

// Возврат «Назад» со страницы оплаты (аудит 2026-11, E14). Браузер достаёт
// страницу из bfcache целиком, вместе с состоянием React: кнопка оплаты так и
// оставалась в «Перехожу к оплате…» и не нажималась. Восстановление из кэша
// приходит событием `pageshow` с `persisted: true` — на нём экран сбрасывает
// то, что имело смысл только до ухода со страницы.

/** Вызывает `reset`, когда страницу вернули из bfcache (кнопка «Назад»). */
export function usePageShowReset(reset: () => void): void {
  const latest = useRef(reset);
  useEffect(() => { latest.current = reset; });

  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => { if (e.persisted) latest.current(); };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);
}

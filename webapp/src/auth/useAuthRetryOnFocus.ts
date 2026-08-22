import { useEffect } from 'react';

// После сна устройства/долгого фона таймер scheduleRefresh (AuthProvider.tsx)
// может не сработать вовремя — браузер троттлит setTimeout в фоновых
// вкладках. Ни один слушатель online/visibilitychange раньше не стоял ни у
// сайта, ни у мини-аппа (диагностика «постоянно нужно логиниться заново»,
// 2026-08-21, пункт 3). Вынесено из AuthProvider.tsx — файл-храповик,
// правило №10 CLAUDE.md.
/** `isStale()` бережёт от лишней ротации токена на каждый фокус вкладки. */
export function useAuthRetryOnFocus(
  isStale: () => boolean,
  refresh: () => void,
): void {
  useEffect(() => {
    const maybeRefresh = () => {
      if (isStale()) refresh();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') maybeRefresh();
    };
    window.addEventListener('online', maybeRefresh);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('online', maybeRefresh);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [isStale, refresh]);
}

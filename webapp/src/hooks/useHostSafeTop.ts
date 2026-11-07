import { useEffect } from 'react';
import { useSafeTop } from '../../../shared/src/host/safezone';

/**
 * Отступ безопасной зоны мессенджера → `--host-safe-top` на корне; `--safe-top`
 * в index.css — max() из неё и env(safe-area-inset-top): писать сам `--safe-top`
 * нельзя — инлайн-0px браузера перекрывал бы статус-бар приложения (#902).
 */
export function useHostSafeTop(): void {
  const top = useSafeTop();
  useEffect(() => {
    document.documentElement.style.setProperty('--host-safe-top', `${top}px`);
    return () => {
      document.documentElement.style.removeProperty('--host-safe-top');
    };
  }, [top]);
}

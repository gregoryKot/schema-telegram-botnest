import { useEffect } from 'react';
import { useSafeTop } from '../../../shared/src/host/safezone';

/**
 * Верхний отступ безопасной зоны мессенджера → CSS-переменная `--safe-top`
 * на корне. Шапка кабинета на телефоне не уходит под плавающие кнопки
 * «Закрыть»/меню Telegram. В браузере значение 0 — вид не меняется.
 */
export function useHostSafeTop(): void {
  const top = useSafeTop();
  useEffect(() => {
    document.documentElement.style.setProperty('--safe-top', `${top}px`);
    return () => {
      document.documentElement.style.removeProperty('--safe-top');
    };
  }, [top]);
}

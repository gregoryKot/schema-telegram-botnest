import { useEffect, useState } from 'react';

/** Нет сети — true. Следит за событиями online/offline браузера. */
export function useIsOffline(): boolean {
  const [offline, setOffline] = useState(!navigator.onLine);
  useEffect(() => {
    const off = () => setOffline(true);
    const on = () => setOffline(false);
    window.addEventListener('offline', off);
    window.addEventListener('online', on);
    return () => {
      window.removeEventListener('offline', off);
      window.removeEventListener('online', on);
    };
  }, []);
  return offline;
}

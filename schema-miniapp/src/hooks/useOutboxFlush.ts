import { useEffect, useState } from 'react';
import { api } from '../api';
import { renewSession } from '../session';
import { logErr } from '../utils/logErr';

/**
 * Офлайн-очередь оценок уходит ТОЛЬКО после того, как сессия выпущена, а
 * значит, владелец локальных данных сверен (markSessionStarted в session.ts).
 * Раньше флаш шёл на маунте по initData: очередь прежнего аккаунта A уезжала
 * в аккаунт B, пока защита E-1 ещё ждала ответа обмена (аудит 2026-10, E-1).
 * Не удалось получить сессию — очередь остаётся до следующего старта или
 * `online`, данные не теряются.
 */
function flushAfterOwnerCheck(): void {
  renewSession()
    .then((ok) => (ok ? api.flushOutbox() : undefined))
    .catch(logErr('flushOutbox'));
}

/** Состояние сети + флаш очереди на старте и при возвращении сети. */
export function useOutboxFlush(): boolean {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  useEffect(() => {
    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => {
      setIsOffline(false);
      flushAfterOwnerCheck();
    };
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    // Очередь могла накопиться в прошлой сессии (webview закрылся до
    // восстановления сети).
    flushAfterOwnerCheck();
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);
  return isOffline;
}

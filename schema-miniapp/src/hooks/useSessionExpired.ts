// Сессию перевыпустить не удалось — приложение обязано сказать это вслух.
// До инцидента 2026-07-29 401 в середине сессии никто не показывал: экраны
// рендерились, кнопки нажимались, а ничего не сохранялось (все вызовы
// .catch(() => {})). Молча неработающее приложение — худший из вариантов.
import { useEffect, useState } from 'react';
import { SESSION_EXPIRED_EVENT } from '../session';

export function useSessionExpired(): boolean {
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    const onExpired = () => setExpired(true);
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);
  return expired;
}

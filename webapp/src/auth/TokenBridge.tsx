import { useEffect } from 'react';
import { useAuth } from './authContext';
import { setTokenProvider, setRefreshHandler } from '../api';

// Мост AuthProvider → api-клиент (живёт внутри AuthProvider). Провайдер —
// getAccessToken (ref, синхронно), а не замыкание на state: после refresh
// state обновится только с рендером, и повтор запроса на 401 уходил бы со
// старым токеном → снова 401 (возврат в PWA через 15+ минут, 2026-11).
export function TokenBridge() {
  const { getAccessToken, refreshToken } = useAuth();
  useEffect(() => {
    setTokenProvider(getAccessToken);
    setRefreshHandler(refreshToken);
  }, [getAccessToken, refreshToken]);
  return null;
}

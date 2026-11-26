import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../auth/authContext';
import { telemetryUrl } from '../utils/telemetryUrl';
import { trackHit, analyticsUrl } from '../lib/metrika';
import { setMetrikaSessionPossible } from '../lib/metrikaGate';

/**
 * Хит страницы при смене маршрута + проводка состояния входа в шлюз Метрики
 * (решение D-4: счётчик только на публичных страницах и только без сессии).
 * Живёт внутри AuthProvider — useAuth нужен именно ради этого.
 */
export function MetrikaTracker() {
  const loc = useLocation();
  const { isAuthenticated, isLoading } = useAuth();
  // Идёт проверка сессии — считаем, что она может быть (см. metrikaGate).
  const sessionPossible = isAuthenticated || isLoading;
  useEffect(() => {
    // Шлюз обновляем ДО хита: иначе первый хит увидит устаревшее состояние.
    setMetrikaSessionPossible(sessionPossible);
    // L6 (аудит 2026-08): голая location.href уносила во фрагменте живой JWT
    // (/auth/callback#access_token=…) в Метрику. analyticsUrl режет секреты
    // из query как telemetryUrl, но сохраняет utm/yclid — иначе реклама
    // Директа не атрибутируется (defer:true — автохита нет, только этот).
    trackHit(analyticsUrl(window.location.href), { referer: telemetryUrl(document.referrer) });
  }, [loc.pathname, loc.search, sessionPossible]);
  return null;
}

import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { nextRetryTimerDelayMs } from '../../../shared/src/auth/sessionRefresh';
import { clearApiCache } from '../../../shared/src/api/apiCache';
import { clearAuthSeen } from '../../../shared/src/auth/authSeen';
import { markSessionStarted } from '../../../shared/src/auth/dataOwnerGuard';
import { postLogout } from '../../../shared/src/auth/logout';
import { AuthContext } from './authContext';
import { clearLocalData } from './clearLocalData';
import { refreshSession } from './refreshSession';
import { telegramWebAppAuth } from './telegramWebAppAuth';
import { useAuthRetryOnFocus } from './useAuthRetryOnFocus';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';
const EXPIRY_SKEW_MS = 60_000; // не дёргаем refresh, если токен ещё жив с запасом

export function AuthProvider({ children, bootstrapSession = true }: { children: ReactNode; bootstrapSession?: boolean }) {
  const [accessToken, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<'transient' | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tokenRef = useRef<string | null>(null);
  const expiresAtRef = useRef(0);
  const retryAttemptRef = useRef(0);
  // Ref — синхронно: повтор запроса после refresh (apiClient) не ждёт рендера, иначе уходит старый токен.
  const setToken = useCallback((t: string | null) => { tokenRef.current = t; setTokenState(t); }, []);

  // Общий таймер refresh/ретрая — раньше ретрая не было, цепочка обрывалась навсегда после первой неудачи (2026-08-21, п.3).
  const armRefreshTimer = useCallback((delayMs: number) => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => {
      // eslint-disable-next-line react-hooks/immutability -- react-compiler: паттерн намеренный, рефактор рискован
      void doRefresh();
    }, delayMs);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- намеренно неполные зависимости (mount-only / стабильные ссылки); добавление рискует ре-фетч-циклами
  }, []);

  const scheduleRefresh = useCallback((expiresIn: number) => {
    expiresAtRef.current = Date.now() + expiresIn * 1000;
    armRefreshTimer(Math.max((expiresIn - 60) * 1000, 5000));
  }, [armRefreshTimer]);

  // Общая точка «сессия жива» для refresh/Telegram-auth/логина — сбрасывает
  // authError и бэкофф ретраев, планирует следующий проактивный refresh.
  const applyToken = useCallback((token: string, expiresIn: number) => {
    // Отметка «вход удавался» (shared/auth/authSeen) + стирание данных прежнего аккаунта (E1).
    markSessionStarted(token);
    setToken(token);
    setAuthError(null);
    retryAttemptRef.current = 0;
    scheduleRefresh(expiresIn);
  }, [scheduleRefresh, setToken]);

  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- react-compiler: ручная мемоизация намеренная
  const doRefresh = useCallback(async (clearOnFailure = true): Promise<boolean> => {
    // Сеть/сервер: in-flight+кросс-табный замок и ретраи — в refreshSession.ts.
    const result = await refreshSession();
    if (result.ok) { applyToken(result.token, result.expiresIn); return true; }
    if (result.dead) {
      // 401/403 от refresh — сессию не восстановить, ретраить нечего.
      if (clearOnFailure) setToken(null);
      setAuthError(null);
      return false;
    }
    // Сеть/5xx/429 — сессия жива, просто не достучались: не разлогиниваем,
    // а планируем повтор растущим бэкоффом (RequireAuth не редиректит на /login при authError==='transient').
    setAuthError('transient');
    armRefreshTimer(nextRetryTimerDelayMs(retryAttemptRef.current));
    retryAttemptRef.current += 1;
    return false;
  }, [applyToken, armRefreshTimer, setToken]);

  // Telegram WebApp auto-auth (сетевая часть — telegramWebAppAuth.ts).
  const doTelegramWebAppAuth = useCallback(async (): Promise<boolean> => {
    const result = await telegramWebAppAuth();
    if (!result.ok) return false;
    applyToken(result.token, result.expiresIn);
    return true;
  }, [applyToken]);

  // On mount: Telegram WebApp auth первым, иначе httpOnly-кука.
  useEffect(() => {
    const init = async () => {
      // Ребёнок мог положить токен раньше (эффекты детей идут первыми) — лишний
      // refresh ротировал бы куку зря. Страницы OAuth токен не кладут: сессию им
      // даёт именно этот refresh по куке из редиректа (login-CSRF, аудит 2026-11).
      // bootstrapSession=false: визитка (kotlarewski.gr) — логина там нет, фоновый
      // refresh только 301-ился бы на schemehappens.ru (CORS) и ретраился бы вечным бэкоффом (#497).
      if (!bootstrapSession || tokenRef.current) { setIsLoading(false); return; }
      const tgOk = await doTelegramWebAppAuth();
      if (!tgOk) await doRefresh(false);
      setIsLoading(false);
    };
    void init();
    return () => { if (refreshTimer.current) clearTimeout(refreshTimer.current); };
  }, [bootstrapSession, doRefresh, doTelegramWebAppAuth]);

  const getAccessToken = useCallback(() => tokenRef.current, []);
  useAuthRetryOnFocus(
    useCallback(() => bootstrapSession && Date.now() + EXPIRY_SKEW_MS >= expiresAtRef.current, [bootstrapSession]),
    useCallback(() => void doRefresh(), [doRefresh]),
  );

  const logout = useCallback(async (all = false) => {
    // Сетевой шаг — общий с мини-аппом (shared/auth/logout, правило №3).
    await postLogout(API_BASE, { all, requestedWith: 'webapp' });
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    setToken(null);
    setAuthError(null);
    clearAuthSeen();
    clearLocalData();
    // Кеш API — в памяти вкладки, не переживает смену пользователя.
    clearApiCache();
  }, [setToken]);

  return (
    <AuthContext.Provider value={{
      accessToken,
      isLoading,
      isAuthenticated: !!accessToken,
      authError,
      setAccessToken: applyToken,
      getAccessToken,
      logout,
      refreshToken: doRefresh,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

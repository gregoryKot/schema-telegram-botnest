import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { getHost } from '../../../shared/src/host';
import { nextRetryTimerDelayMs } from '../../../shared/src/auth/sessionRefresh';
import { AuthContext } from './authContext';
import { clearLocalData } from './clearLocalData';
import { refreshSession } from './refreshSession';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';
const EXPIRY_SKEW_MS = 60_000; // не дёргаем refresh, если токен ещё жив с запасом

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<'transient' | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasToken = useRef(false);
  const expiresAtRef = useRef(0);
  const retryAttemptRef = useRef(0);

  const scheduleRefresh = useCallback((expiresIn: number) => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    expiresAtRef.current = Date.now() + expiresIn * 1000;
    const delay = Math.max((expiresIn - 60) * 1000, 5000);
    refreshTimer.current = setTimeout(() => {
      // eslint-disable-next-line react-hooks/immutability -- react-compiler: паттерн намеренный, рефактор рискован
      void doRefresh();
    }, delay);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- намеренно неполные зависимости (mount-only / стабильные ссылки); добавление рискует ре-фетч-циклами
  }, []);

  // Цепочка авто-обновления раньше обрывалась навсегда после одной осечки —
  // scheduleRefresh вызывался только из ветки успеха (диагностика «постоянно
  // нужно логиниться заново», 2026-08-21, пункт 3). Бэкофф растёт с номером
  // попытки, чтобы не долбить сервер, пока сеть реально недоступна.
  const scheduleRetry = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    const delay = nextRetryTimerDelayMs(retryAttemptRef.current);
    retryAttemptRef.current += 1;
    refreshTimer.current = setTimeout(() => {
      // eslint-disable-next-line react-hooks/immutability -- react-compiler: паттерн намеренный, рефактор рискован
      void doRefresh();
    }, delay);
  }, []);

  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- react-compiler: ручная мемоизация намеренная
  const doRefresh = useCallback(async (clearOnFailure = true): Promise<boolean> => {
    // Сеть/сервер: in-flight+кросс-табный замок и ретраи — в refreshSession.ts.
    const result = await refreshSession();
    if (result.ok) {
      hasToken.current = true;
      setTokenState(result.token);
      setAuthError(null);
      retryAttemptRef.current = 0;
      scheduleRefresh(result.expiresIn);
      return true;
    }
    if (result.dead) {
      // 401/403 от refresh — сессию не восстановить этим путём.
      if (clearOnFailure) setTokenState(null);
      setAuthError(null);
      return false;
    }
    // Сеть/5xx/429 — сессия жива, просто не достучались: НЕ разлогиниваем
    // (RequireAuth не редиректит на /login при authError==='transient'), а
    // планируем повтор — иначе цепочка обрывается навсегда после осечки.
    setAuthError('transient');
    scheduleRetry();
    return false;
  }, [scheduleRefresh, scheduleRetry]);

  // Try Telegram WebApp auto-auth using initData
  const doTelegramWebAppAuth = useCallback(async (): Promise<boolean> => {
    try {
      // Сайт открыт во встроенном браузере мессенджера — меняем его подпись
      // на сессию тем эндпоинтом, который назвал сам хост.
      const exchange = getHost().sessionExchange();
      if (!exchange) return false;

      const res = await fetch(`${API_BASE}${exchange.path}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(exchange.body),
      });
      if (!res.ok) return false;
      const { accessToken: token, expiresIn } = await res.json() as { accessToken: string; expiresIn: number };
      hasToken.current = true;
      setTokenState(token);
      scheduleRefresh(expiresIn);
      return true;
    } catch {
      return false;
    }
  }, [scheduleRefresh]);

  // On mount: try Telegram WebApp auth first, then fall back to httpOnly cookie
  useEffect(() => {
    const init = async () => {
      // Сессия уже выдана этой загрузке страницы: AuthCallback положил токен
      // из OAuth-редиректа раньше (эффекты детей выполняются до эффектов
      // родителя). Лишний refresh тут не бесполезен, а вреден — он ротирует
      // refresh-куку, а страница /auth/callback тут же уходит на /app/ полным
      // переходом. Ответ с новой кукой не доезжает, у мини-аппа остаётся
      // старая, сервер видит повторное использование, отзывает всю семью
      // токенов — и пользователь, только что вошедший, снова без сессии.
      if (hasToken.current) { setIsLoading(false); return; }
      const tgOk = await doTelegramWebAppAuth();
      if (!tgOk) await doRefresh(false);
      setIsLoading(false);
    };
    void init();
    return () => { if (refreshTimer.current) clearTimeout(refreshTimer.current); };
  }, [doRefresh, doTelegramWebAppAuth]);

  // Фоновая вкладка троттлит setTimeout — после сна устройства/долгого фона
  // scheduleRefresh мог не сработать вовремя, и ни один слушатель online/
  // visibilitychange раньше не стоял ни у сайта, ни у мини-аппа (2026-08-21,
  // пункт 3). EXPIRY_SKEW_MS бережёт от лишней ротации токена на каждый фокус.
  useEffect(() => {
    const maybeRefresh = () => {
      if (Date.now() + EXPIRY_SKEW_MS < expiresAtRef.current) return;
      void doRefresh();
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
  }, [doRefresh]);

  const setAccessToken = useCallback((token: string, expiresIn: number) => {
    hasToken.current = true;
    setTokenState(token);
    setAuthError(null);
    retryAttemptRef.current = 0;
    scheduleRefresh(expiresIn);
  }, [scheduleRefresh]);

  const logout = useCallback(async (all = false) => {
    try {
      await fetch(`${API_BASE}/api/auth/logout${all ? '?all=true' : ''}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'x-requested-with': 'webapp', 'Content-Type': 'application/json' },
      });
    } catch { /* ignore */ }
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    hasToken.current = false;
    setTokenState(null);
    setAuthError(null);
    clearLocalData();
  }, []);

  return (
    <AuthContext.Provider value={{
      accessToken,
      isLoading,
      isAuthenticated: !!accessToken,
      authError,
      setAccessToken,
      logout,
      refreshToken: doRefresh,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

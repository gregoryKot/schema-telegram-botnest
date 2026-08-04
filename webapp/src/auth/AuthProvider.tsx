import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { getHost } from '../../../shared/src/host';
import { AuthContext } from './authContext';
import { clearLocalData } from './clearLocalData';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasToken = useRef(false);

  const scheduleRefresh = useCallback((expiresIn: number) => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    // Refresh 60s before expiry
    const delay = Math.max((expiresIn - 60) * 1000, 5000);
    refreshTimer.current = setTimeout(async () => {
      // eslint-disable-next-line react-hooks/immutability -- react-compiler: паттерн намеренный, рефактор рискован
      await doRefresh();
    }, delay);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- намеренно неполные зависимости (mount-only / стабильные ссылки); добавление рискует ре-фетч-циклами
  }, []);

  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- react-compiler: ручная мемоизация намеренная
  const doRefresh = useCallback(async (clearOnFailure = true): Promise<boolean> => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include', // send httpOnly cookie
        headers: { 'x-requested-with': 'webapp', 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        // 401 means token is invalid/revoked – clear state to stop retry loop.
        if (res.status === 401 && clearOnFailure) setTokenState(null);
        return false;
      }
      const { accessToken: token, expiresIn } = await res.json() as { accessToken: string; expiresIn: number };
      hasToken.current = true;
      setTokenState(token);
      scheduleRefresh(expiresIn);
      return true;
    } catch {
      return false;
    }
  }, [scheduleRefresh]);

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
    init();
    return () => { if (refreshTimer.current) clearTimeout(refreshTimer.current); };
  }, [doRefresh, doTelegramWebAppAuth]);

  const setAccessToken = useCallback((token: string, expiresIn: number) => {
    hasToken.current = true;
    setTokenState(token);
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
    clearLocalData();
  }, []);

  return (
    <AuthContext.Provider value={{
      accessToken,
      isLoading,
      isAuthenticated: !!accessToken,
      setAccessToken,
      logout,
      refreshToken: doRefresh,
    }}>
      {children}
    </AuthContext.Provider>
  );
}


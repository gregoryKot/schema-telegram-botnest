import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

interface AuthState {
  accessToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setAccessToken: (token: string, expiresIn: number) => void;
  logout: (all?: boolean) => Promise<void>;
  refreshToken: () => Promise<boolean>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleRefresh = useCallback((expiresIn: number) => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    // Refresh 60s before expiry
    const delay = Math.max((expiresIn - 60) * 1000, 5000);
    refreshTimer.current = setTimeout(async () => {
      await doRefresh();
    }, delay);
  }, []);

  const doRefresh = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include', // send httpOnly cookie
        headers: { 'x-requested-with': 'webapp', 'Content-Type': 'application/json' },
      });
      if (!res.ok) return false;
      const { accessToken: token, expiresIn } = await res.json() as { accessToken: string; expiresIn: number };
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
      const tg = (window as any).Telegram?.WebApp;
      const initData = tg?.initData;
      if (!initData) return false;

      const res = await fetch(`${API_BASE}/api/auth/telegram/webapp`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData }),
      });
      if (!res.ok) return false;
      const { accessToken: token, expiresIn } = await res.json() as { accessToken: string; expiresIn: number };
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
      const tgOk = await doTelegramWebAppAuth();
      if (!tgOk) await doRefresh();
      setIsLoading(false);
    };
    init();
    return () => { if (refreshTimer.current) clearTimeout(refreshTimer.current); };
  }, [doRefresh, doTelegramWebAppAuth]);

  const setAccessToken = useCallback((token: string, expiresIn: number) => {
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
    setTokenState(null);
    // Clinical content (letters, safe place, diary drafts, YSQ answers, schema
    // labels) is mirrored into localStorage for instant render. On logout –
    // especially on a shared device – wipe it so the next person can't read it.
    // Theme is the only non-sensitive key worth keeping. Server stays the
    // source of truth, so nothing is lost on the next login.
    try {
      const theme = localStorage.getItem('app_theme');
      localStorage.clear();
      sessionStorage.clear();
      if (theme) localStorage.setItem('app_theme', theme);
    } catch { /* ignore */ }
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

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';

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

  // On mount: try to restore session from httpOnly cookie
  useEffect(() => {
    doRefresh().finally(() => setIsLoading(false));
    return () => { if (refreshTimer.current) clearTimeout(refreshTimer.current); };
  }, [doRefresh]);

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

import { createContext, useContext } from 'react';

export interface AuthState {
  accessToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setAccessToken: (token: string, expiresIn: number) => void;
  logout: (all?: boolean) => Promise<void>;
  refreshToken: () => Promise<boolean>;
}

export const AuthContext = createContext<AuthState | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

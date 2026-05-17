import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { setTokenProvider } from './api';
import { LoginPage } from './pages/LoginPage';
import { AuthCallback } from './pages/AuthCallback';
import { AppShell } from './components/AppShell';

// Apply saved theme before first render
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'light') document.documentElement.setAttribute('data-theme', 'light');

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <div className="loader-center"><div className="spinner" /></div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function TokenBridge() {
  const { accessToken } = useAuth();
  useEffect(() => {
    setTokenProvider(() => accessToken);
  }, [accessToken]);
  return null;
}

function AppRoutes() {
  return (
    <>
      <TokenBridge />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/auth/error" element={
          <div className="loader-center" style={{ flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 48 }}>⚠️</div>
            <p style={{ color: 'var(--text-sub)' }}>
              Ошибка входа.{' '}
              <a href="/login" style={{ color: 'var(--accent)' }}>Попробовать снова</a>
            </p>
          </div>
        } />
        <Route path="/*" element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        } />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

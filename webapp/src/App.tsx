import { createBrowserRouter, RouterProvider, Navigate, Outlet } from 'react-router-dom';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { setTokenProvider } from './api';
import { LoginPage } from './pages/LoginPage';
import { AuthCallback } from './pages/AuthCallback';
import { AccountPage } from './pages/AccountPage';
import { MergePage } from './pages/MergePage';
import { AppShell } from './components/AppShell';

// Apply saved theme before first render
const savedTheme = localStorage.getItem('app_theme');
if (savedTheme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');

// ── Token bridge (inside AuthProvider) ────────────────────────────────────────
function TokenBridge() {
  const { accessToken } = useAuth();
  useEffect(() => { setTokenProvider(() => accessToken); }, [accessToken]);
  return null;
}

// ── Auth guard as a layout route ───────────────────────────────────────────────
function RequireAuth() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <div className="loader-center"><div className="spinner" /></div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Outlet />;
}

// ── Root layout — providers wrapper ───────────────────────────────────────────
function Root() {
  return (
    <AuthProvider>
      <TokenBridge />
      <Outlet />
    </AuthProvider>
  );
}

// ── Router ─────────────────────────────────────────────────────────────────────
const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      // Public
      { path: '/login',          element: <LoginPage /> },
      { path: '/auth/callback',  element: <AuthCallback /> },
      { path: '/auth/error',     element: <AuthError /> },

      // Authenticated
      {
        element: <RequireAuth />,
        children: [
          { path: '/account',       element: <AccountPage /> },
          { path: '/account/merge', element: <MergePage /> },

          // App shell — all app routes as children
          {
            element: <AppShell />,
            children: [
              { index: true,                  element: <Navigate to="/today" replace /> },
              { path: '/today',               element: null },
              { path: '/diary',               element: null },
              { path: '/schemas',             element: null },
              { path: '/profile',             element: null },
              { path: '/practice',            element: null },
              // Legacy redirects
              { path: '/help',                element: <Navigate to="/practice" replace /> },
              { path: '/exercises',           element: <Navigate to="/practice" replace /> },
              { path: '/cabinet',             element: null },
              { path: '/cabinet/:clientId',   element: null },
              // catch-all → redirect home
              { path: '*',                    element: <Navigate to="/today" replace /> },
            ],
          },
        ],
      },
    ],
  },
]);

function AuthError() {
  return (
    <div className="loader-center" style={{ flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 48 }}>⚠️</div>
      <p style={{ color: 'var(--text-sub)' }}>
        Ошибка входа.{' '}
        <a href="/login" style={{ color: 'var(--accent)' }}>Попробовать снова</a>
      </p>
    </div>
  );
}

export default function App() {
  return <RouterProvider router={router} />;
}

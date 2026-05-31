import { createBrowserRouter, RouterProvider, Navigate, Outlet } from 'react-router-dom';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { setTokenProvider } from './api';
import { LoginPage } from './pages/LoginPage';
import { AuthCallback } from './pages/AuthCallback';
import { AccountPage } from './pages/AccountPage';
import { MergePage } from './pages/MergePage';
import { AppShell } from './components/AppShell';
import { LandingPage } from './pages/LandingPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { OfferPage } from './pages/OfferPage';
import { ArticlesListPage, ArticlePage } from './pages/ArticlesPage';

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

// ── Root layout – providers wrapper ───────────────────────────────────────────
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
      { path: '/',               element: <LandingPage /> },
      { path: '/articles',       element: <ArticlesListPage /> },
      { path: '/articles/:slug', element: <ArticlePage /> },
      { path: '/privacy',        element: <PrivacyPage /> },
      { path: '/offer',          element: <OfferPage /> },
      { path: '/login',          element: <LoginPage /> },
      { path: '/auth/callback',  element: <AuthCallback /> },
      { path: '/auth/error',     element: <AuthError /> },

      // Authenticated
      {
        element: <RequireAuth />,
        children: [
          { path: '/account',       element: <AccountPage /> },
          { path: '/account/merge', element: <MergePage /> },

          // App shell – all app routes as children
          {
            element: <AppShell />,
            children: [
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
    <div style={{ flex: 1, minHeight: '100dvh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
      <div style={{ textAlign: 'center', maxWidth: 400 }}>
        <div className="eyebrow" style={{ color: 'var(--c-rose)', marginBottom: 20 }}>Ошибка входа</div>
        <h1 style={{ fontFamily: 'var(--serif)', fontSize: 42, fontWeight: 400, lineHeight: 1.15, color: 'var(--text)', margin: '0 0 16px' }}>
          Что-то<br /><span style={{ fontStyle: 'italic' }}>пошло не так</span>
        </h1>
        <p style={{ fontSize: 15, color: 'var(--text-sub)', lineHeight: 1.7, margin: '0 0 36px' }}>
          Авторизация не удалась. Попробуй снова или обратись к нам в Telegram.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="/login" style={{ display: 'inline-block', padding: '13px 28px', background: 'var(--text)', color: 'var(--bg)', borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
            Попробовать снова
          </a>
          <a href="https://t.me/kotlarewski" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', padding: '13px 28px', background: 'rgba(var(--fg-rgb),0.06)', color: 'var(--text-sub)', borderRadius: 12, fontSize: 15, fontWeight: 500, textDecoration: 'none' }}>
            Написать
          </a>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return <RouterProvider router={router} />;
}

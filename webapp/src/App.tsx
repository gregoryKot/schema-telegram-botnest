import { createBrowserRouter, RouterProvider, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';

// ── Yandex.Metrika SPA pageview tracking ──────────────────────────────────────
const YM_ID = 109568051;
declare global { interface Window { ym?: (id: number, action: string, ...args: unknown[]) => void } }

function MetrikaTracker() {
  const loc = useLocation();
  useEffect(() => {
    window.ym?.(YM_ID, 'hit', window.location.href, { referer: document.referrer });
  }, [loc.pathname, loc.search]);
  return null;
}
import { AuthProvider, useAuth } from './auth/AuthContext';
import { setTokenProvider } from './api';
import { LoginPage } from './pages/LoginPage';
import { AuthCallback } from './pages/AuthCallback';
import { TelegramWidgetCallback } from './pages/TelegramWidgetCallback';
import { AccountPage } from './pages/AccountPage';
import { MergePage } from './pages/MergePage';
import { TwoFactorChallengePage } from './pages/TwoFactorChallengePage';
import { RecoveryPage } from './pages/RecoveryPage';
import { AppShell } from './components/AppShell';
import { CookieBanner } from './components/CookieBanner';
import { AddressFormPicker } from './components/AddressFormPicker';
import { LandingPage } from './pages/LandingPage';
import { ProductLandingPage } from './pages/ProductLandingPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { OfferPage } from './pages/OfferPage';
import { ArticlesListPage, ArticlePage } from './pages/ArticlesPage';
import { ReviewsPage } from './pages/ReviewsPage';
import { GamePage } from './pages/GamePage';
// Lazy: pulls in the TipTap WYSIWYG editor, which shouldn't bloat the main
// bundle every visitor downloads just for the public site.
const AdminPage = lazy(() => import('./pages/AdminPage').then(m => ({ default: m.AdminPage })));
import { DonatePage } from './pages/DonatePage';
import { BookingPaidPage } from './pages/BookingPaidPage';
import { SubscribePage } from './pages/SubscribePage';

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
  return (
    <>
      <AddressFormPicker />
      <Outlet />
    </>
  );
}

// ── Root layout – providers wrapper ───────────────────────────────────────────
function Root() {
  return (
    <AuthProvider>
      <TokenBridge />
      <MetrikaTracker />
      <Outlet />
      <CookieBanner />
    </AuthProvider>
  );
}

// ── Domain detection ──────────────────────────────────────────────────────────
const isPersonalSite = window.location.hostname.includes('kotlarewski')
  || new URLSearchParams(window.location.search).get('site') === 'personal';

if (isPersonalSite) {
  document.querySelectorAll("link[rel='icon']").forEach((el) => {
    const link = el as HTMLLinkElement;
    if (link.sizes?.value === '96x96') {
      link.href = '/favicon-personal-32.png';
    } else {
      link.type = 'image/png';
      link.href = '/favicon-personal-32.png';
    }
  });
}

// ── Router ─────────────────────────────────────────────────────────────────────
const personalRoutes = [
  { path: '/',               element: <LandingPage /> },
  { path: '/articles',       element: <ArticlesListPage /> },
  { path: '/articles/:slug', element: <ArticlePage /> },
  { path: '/reviews',        element: <ReviewsPage /> },
  { path: '/game',           element: <GamePage /> },
  { path: '/admin',          element: <Suspense fallback={null}><AdminPage /></Suspense> },
  { path: '/booking-admin',  element: <Navigate to="/admin" replace /> },
  { path: '/articles-admin', element: <Navigate to="/admin" replace /> },
  { path: '/booking/paid',   element: <BookingPaidPage /> },
  { path: '/subscribe',      element: <SubscribePage /> },
  { path: '/donate',         element: <DonatePage /> },
  { path: '/privacy',        element: <PrivacyPage /> },
  { path: '/offer',          element: <OfferPage /> },
  { path: '*',               element: <Navigate to="/" replace /> },
];

const appRoutes = [
  { path: '/',               element: <ProductLandingPage /> },
  { path: '/subscribe',      element: <SubscribePage /> },
  { path: '/donate',         element: <DonatePage /> },
  // Admin panel is gated by its own key (not the app login), so it's reachable
  // on the app domain too — otherwise /admin here falls through to the login/app.
  { path: '/admin',          element: <Suspense fallback={null}><AdminPage /></Suspense> },
  { path: '/booking-admin',  element: <Navigate to="/admin" replace /> },
  { path: '/articles-admin', element: <Navigate to="/admin" replace /> },
  { path: '/login',          element: <LoginPage /> },
  { path: '/auth/callback',  element: <AuthCallback /> },
  { path: '/auth/telegram',  element: <TelegramWidgetCallback /> },
  { path: '/auth/2fa',       element: <TwoFactorChallengePage /> },
  { path: '/auth/recovery',         element: <RecoveryPage /> },
  { path: '/auth/recovery/confirm', element: <RecoveryPage /> },
  { path: '/auth/error',     element: <AuthError /> },
  {
    element: <RequireAuth />,
    children: [
      { path: '/account',       element: <AccountPage /> },
      { path: '/account/merge', element: <MergePage /> },
      {
        element: <AppShell />,
        children: [
          { path: '/today',             element: null },
          { path: '/diary',             element: null },
          { path: '/schemas',           element: null },
          { path: '/profile',           element: null },
          { path: '/practice',          element: null },
          { path: '/help',              element: <Navigate to="/practice" replace /> },
          { path: '/exercises',         element: <Navigate to="/practice" replace /> },
          { path: '/cabinet',           element: null },
          { path: '/cabinet/:clientId', element: null },
          { path: '*',                  element: <Navigate to="/today" replace /> },
        ],
      },
    ],
  },
];

const router = createBrowserRouter([
  {
    element: <Root />,
    children: isPersonalSite ? personalRoutes : appRoutes,
  },
]);

function AuthError() {
  const reason = new URLSearchParams(window.location.search).get('reason') ?? '';
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
        {reason && (
          <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: '0 0 24px', fontFamily: 'monospace', wordBreak: 'break-all' }}>
            {reason}
          </p>
        )}
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

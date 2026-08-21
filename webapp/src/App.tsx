import { createBrowserRouter, RouterProvider, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import { telemetryUrl } from './utils/telemetryUrl';
import { applyPersonalSiteChrome } from './utils/domainChrome';

// ── Yandex.Metrika SPA pageview tracking ──────────────────────────────────────
const YM_ID = 109568051;
declare global { interface Window { ym?: (id: number, action: string, ...args: unknown[]) => void } }

function MetrikaTracker() {
  const loc = useLocation();
  useEffect(() => {
    // L6 (аудит 2026-08): голая location.href уносила во фрагменте живой JWT
    // (/auth/callback#access_token=…) в Метрику. telemetryUrl оставляет путь.
    window.ym?.(YM_ID, 'hit', telemetryUrl(window.location.href), { referer: telemetryUrl(document.referrer) });
  }, [loc.pathname, loc.search]);
  return null;
}
import { AuthProvider } from './auth/AuthProvider';
import { useAuth } from './auth/authContext';
import { setTokenProvider } from './api';
import { LoginPage } from './pages/LoginPage';
import { AuthErrorPage } from './pages/AuthErrorPage';
import { AuthCallback } from './pages/AuthCallback';
import { TelegramWidgetCallback } from './pages/TelegramWidgetCallback';
import { AccountPage } from './pages/AccountPage';
import { MergePage } from './pages/MergePage';
import { LinkDevicePage } from './pages/LinkDevicePage';
import { TwoFactorChallengePage } from './pages/TwoFactorChallengePage';
import { RecoveryPage } from './pages/RecoveryPage';
import { AppShell } from './components/AppShell';
import { CookieBanner } from './components/CookieBanner';
import { AddressFormPicker } from './components/AddressFormPicker';
import { AddressFormProvider } from './utils/AddressFormProvider';
import { LandingPage } from './pages/LandingPage';
import { ProductLandingPage } from './pages/ProductLandingPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { OfferPage } from './pages/OfferPage';
import { ArticlesListPage, ArticlePage } from './pages/ArticlesPage';
import { TestsPage } from './pages/tests/TestsPage';
import { QuizPage } from './pages/tests/QuizPage';
import { ReviewsPage } from './pages/ReviewsPage';
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
    <AddressFormProvider>
      <AddressFormPicker />
      <Outlet />
    </AddressFormProvider>
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

if (isPersonalSite) applyPersonalSiteChrome();

// ── Router ─────────────────────────────────────────────────────────────────────
const personalRoutes = [
  { path: '/',               element: <LandingPage /> },
  { path: '/articles',       element: <ArticlesListPage /> },
  { path: '/articles/:slug', element: <ArticlePage /> },
  { path: '/reviews',        element: <ReviewsPage /> },
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
  { path: '/articles',       element: <ArticlesListPage /> },
  { path: '/articles/:slug', element: <ArticlePage /> },
  // Мини-тесты — публичный лид-магнит, регистрация не нужна.
  { path: '/tests',          element: <TestsPage /> },
  { path: '/tests/:quizId',  element: <QuizPage /> },
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
  { path: '/auth/error',     element: <AuthErrorPage /> },
  { path: '/link',           element: <LinkDevicePage /> },
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

export default function App() {
  return <RouterProvider router={router} />;
}

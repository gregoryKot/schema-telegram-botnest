import { createBrowserRouter, RouterProvider, Navigate, Outlet } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import { applyPersonalSiteChrome, isPracticeHost } from './utils/domainChrome';
import { MetrikaTracker } from './components/MetrikaTracker';
import { AuthProvider } from './auth/AuthProvider';
import { useAuth } from './auth/authContext';
import { setTokenProvider, setRefreshHandler } from './api';
import { LoginPage } from './pages/LoginPage';
import { AuthErrorPage } from './pages/AuthErrorPage';
import { AuthCallback } from './pages/AuthCallback';
import { AuthConfirmPage } from './pages/AuthConfirmPage';
import { TelegramWidgetCallback } from './pages/TelegramWidgetCallback';
import { AccountPage } from './pages/AccountPage';
import { MergePage } from './pages/MergePage';
import { LinkDevicePage } from './pages/LinkDevicePage';
import { TwoFactorChallengePage } from './pages/TwoFactorChallengePage';
import { RecoveryPage } from './pages/RecoveryPage';
import { AppShell } from './components/AppShell';
import { CookieBanner } from './components/CookieBanner';
import { RouteErrorScreen } from './components/RouteErrorScreen';
import { PracticeBrand } from './components/PracticeBrand';
import { RequireAuth } from './components/RequireAuth';
import { LandingPage } from './pages/LandingPage';
import { ProductLandingPage } from './pages/ProductLandingPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { OfferPage } from './pages/OfferPage';
import { ArticlesListPage, ArticlePage } from './pages/ArticlesPage';
import { TestsPage } from './pages/tests/TestsPage';
import { QuizPage } from './pages/tests/QuizPage';
import { ReviewsPage } from './pages/ReviewsPage';
// Lazy: pulls in the TipTap WYSIWYG editor, which shouldn't bloat the main bundle every visitor downloads just for the public site.
const AdminPage = lazy(() => import('./pages/AdminPage').then(m => ({ default: m.AdminPage })));
import { DonatePage } from './pages/DonatePage';
import { BookingPaidRoute } from './components/booking/BookingPaidRoute';
const BookingLinkPage = lazy(() => import('./pages/BookingLinkPage').then(m => ({ default: m.BookingLinkPage }))); // не в главном чанке: страница по ссылке
const SubscribePage = lazy(() => import('./pages/SubscribePage').then(m => ({ default: m.SubscribePage }))); // не в главном чанке: редкая страница по ссылке

// Apply saved theme before first render
if (localStorage.getItem('app_theme') === 'dark') document.documentElement.setAttribute('data-theme', 'dark');

// ── Token bridge (inside AuthProvider) ────────────────────────────────────────
function TokenBridge() {
  const { accessToken, refreshToken } = useAuth();
  useEffect(() => { setTokenProvider(() => accessToken); setRefreshHandler(refreshToken); }, [accessToken, refreshToken]);
  return null;
}
// ── Root layout – providers wrapper ───────────────────────────────────────────
function Root() {
  return (
    <AuthProvider bootstrapSession={!isPersonalSite}>
      <TokenBridge />
      <MetrikaTracker />
      <Outlet />
      <CookieBanner />
    </AuthProvider>
  );
}

// ── Domain detection ──────────────────────────────────────────────────────────
const isPersonalSite = isPracticeHost(window.location.hostname)
  || new URLSearchParams(window.location.search).get('site') === 'personal';

if (isPersonalSite) applyPersonalSiteChrome();

// ── Router ─────────────────────────────────────────────────────────────────────
const personalRoutes = [
  // Страницы визитки — под одним брендом (индиго, см. PracticeBrand).
  {
    element: <PracticeBrand />,
    children: [
      { path: '/',               element: <LandingPage /> },
      { path: '/articles',       element: <ArticlesListPage /> },
      { path: '/articles/:slug', element: <ArticlePage /> },
      { path: '/reviews',        element: <ReviewsPage /> },
      { path: '/book',           element: <Suspense fallback={null}><BookingLinkPage /></Suspense> }, // ссылка для клиентов: расписание сразу
      { path: '/booking/paid',   element: <BookingPaidRoute /> },
      // Ссылка управления записью (BookingSaveBlock/.ics URL:) — тот же компонент,
      // что у /booking/paid: путь переименовывать нельзя, туда редиректит
      // Робокасса, а новая capability-ссылка ведёт на другой путь.
      { path: '/booking/manage', element: <BookingPaidRoute /> },
      { path: '/privacy',        element: <PrivacyPage /> },
      { path: '/offer',          element: <OfferPage /> },
    ],
  },
  // Вне бренда визитки — осознанно:
  // /admin и редиректы — служебный инструмент, одинаковый на обоих доменах.
  { path: '/admin',          element: <Suspense fallback={null}><AdminPage /></Suspense> },
  { path: '/booking-admin',  element: <Navigate to="/admin" replace /> },
  { path: '/articles-admin', element: <Navigate to="/admin" replace /> },
  // /subscribe и /donate — на .light-lock + styles/auth-pay.css (PR #740):
  // .light-lock сам переопределяет акцент, страницы осознанно продуктовые.
  { path: '/subscribe',      element: <Suspense fallback={null}><SubscribePage /></Suspense> },
  { path: '/donate',         element: <DonatePage /> },
  { path: '*',               element: <Navigate to="/" replace /> },
];

const appRoutes = [
  { path: '/',               element: <ProductLandingPage /> },
  { path: '/articles',       element: <ArticlesListPage /> },
  { path: '/articles/:slug', element: <ArticlePage /> },
  // Мини-тесты — публичный лид-магнит, регистрация не нужна.
  { path: '/tests',          element: <TestsPage /> },
  { path: '/tests/:quizId',  element: <QuizPage /> },
  { path: '/subscribe',      element: <Suspense fallback={null}><SubscribePage /></Suspense> },
  { path: '/donate',         element: <DonatePage /> },
  // Юрстраницы — на обоих хостах (инцидент 2026-10-22); сверка: sitemap.middleware.spec.ts.
  { path: '/privacy',        element: <PrivacyPage /> },
  { path: '/offer',          element: <OfferPage /> },
  // Admin panel is gated by its own key (not the app login), so it's reachable
  // on the app domain too — otherwise /admin here falls through to the login/app.
  { path: '/admin',          element: <Suspense fallback={null}><AdminPage /></Suspense> },
  { path: '/booking-admin',  element: <Navigate to="/admin" replace /> },
  { path: '/articles-admin', element: <Navigate to="/admin" replace /> },
  { path: '/login',          element: <LoginPage /> },
  { path: '/auth/callback',  element: <AuthCallback /> },
  { path: '/auth/confirm',   element: <AuthConfirmPage /> },
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
    errorElement: <RouteErrorScreen />,
    children: isPersonalSite ? personalRoutes : appRoutes,
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}

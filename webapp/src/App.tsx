import { createBrowserRouter, RouterProvider, Navigate, Outlet } from 'react-router-dom';
import { lazy, Suspense, type ComponentType } from 'react';
import { applyPersonalSiteChrome } from './utils/domainChrome';
import { savedTheme } from './utils/theme';
import { resolvePersonalSite } from './utils/personalSite';
import { MetrikaTracker } from './components/MetrikaTracker';
import { AuthProvider } from './auth/AuthProvider';
import { TokenBridge } from './auth/TokenBridge';
import { AccountPage } from './pages/AccountPage';
import { AppShell } from './components/AppShell';
import { CookieBanner } from './components/CookieBanner';
import { ScrollLock } from './hooks/ScrollLock';
import { ScrollToTop } from './hooks/ScrollToTop';
import { RouteErrorScreen } from './components/RouteErrorScreen';
import { PracticeBrand } from './components/PracticeBrand';
import { RequireAuth } from './components/RequireAuth';
import { LandingPage } from './pages/LandingPage';
import { ProductLandingPage } from './pages/ProductLandingPage';
import { ArticlesListPage, ArticlePage } from './pages/ArticlesPage';
import { TestsPage } from './pages/tests/TestsPage';
import { QuizPage } from './pages/tests/QuizPage';
import { ReviewsPage } from './pages/ReviewsPage';
import { LoginPage } from './pages/LoginPage'; // вход и служебные — после прочих: их PaperOutcome (sceneKit) иначе переставляет CSS-чанки (b26)
import { AuthCallback } from './pages/AuthCallback';
import { TelegramWidgetCallback } from './pages/TelegramWidgetCallback';
// Lazy: pulls in the TipTap WYSIWYG editor, which shouldn't bloat the main bundle every visitor downloads just for the public site.
const AdminPage = lazy(() => import('./pages/AdminPage').then(m => ({ default: m.AdminPage })));
import { BookingPaidRoute } from './components/booking/BookingPaidRoute';
const BookingLinkPage = lazy(() => import('./pages/BookingLinkPage').then(m => ({ default: m.BookingLinkPage }))); // не в главном чанке: страница по ссылке
const SubscribePage = lazy(() => import('./pages/SubscribePage').then(m => ({ default: m.SubscribePage }))); // не в главном чанке: редкая страница по ссылке
const PrivacyPage = lazy(() => import('./pages/PrivacyPage').then(m => ({ default: m.PrivacyPage }))); // юридические тексты — редкие страницы, ~20 КБ текста
const OfferPage = lazy(() => import('./pages/OfferPage').then(m => ({ default: m.OfferPage })));

// Редкие экраны по ссылке (служебные, /link, объединение, 2FA, донат, 404) — ленивыми маршрутами, не в
// главном чанке (бандл-храповик, b26–b28); вход (/login) остаётся в нём — первый экран.
const lazyRoute = (load: () => Promise<ComponentType>) => async () => ({ Component: await load() });
const linkRoute = lazyRoute(async () => (await import('./pages/LinkDevicePage')).LinkDevicePage);
const mergeRoute = lazyRoute(async () => (await import('./pages/MergePage')).MergePage);
const donateRoute = lazyRoute(async () => (await import('./pages/DonatePage')).DonatePage);
const notFoundRoute = lazyRoute(async () => (await import('./pages/NotFoundPage')).NotFoundPage);
const authConfirmRoute = lazyRoute(async () => (await import('./pages/AuthConfirmPage')).AuthConfirmPage);
const authErrorRoute = lazyRoute(async () => (await import('./pages/AuthErrorPage')).AuthErrorPage);
const twoFactorRoute = lazyRoute(async () => (await import('./pages/TwoFactorChallengePage')).TwoFactorChallengePage);

if (savedTheme() === 'dark') document.documentElement.setAttribute('data-theme', 'dark'); // saved theme before first render; без try хранилище роняло модуль — белый экран (E10)

// ── Root layout – providers wrapper ───────────────────────────────────────────
function Root({ personal }: { personal: boolean }) {
  return (
    <AuthProvider bootstrapSession={!personal}>
      <TokenBridge />
      <MetrikaTracker />
      <Outlet />
      <CookieBanner />
      <ScrollLock />
      <ScrollToTop />
    </AuthProvider>
  );
}

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
      { path: '/privacy',        element: <Suspense fallback={null}><PrivacyPage /></Suspense> },
      { path: '/offer',          element: <Suspense fallback={null}><OfferPage /></Suspense> },
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
  { path: '/donate',         lazy: donateRoute },
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
  { path: '/donate',         lazy: donateRoute },
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
  { path: '/auth/confirm',   lazy: authConfirmRoute },
  { path: '/auth/telegram',  element: <TelegramWidgetCallback /> },
  { path: '/auth/2fa',       lazy: twoFactorRoute },
  { path: '/auth/error',     lazy: authErrorRoute },
  { path: '/link',           lazy: linkRoute },
  { path: '/install',        lazy: async () => ({ Component: (await import('./pages/InstallPage')).InstallPage }) }, // рекламная посадочная: не в главном чанке
  {
    element: <RequireAuth />,
    children: [
      { path: '/account',       element: <AccountPage /> },
      { path: '/account/merge', lazy: mergeRoute },
      {
        element: <AppShell />,
        children: [
          { path: '/today',             element: null },
          { path: '/diary',             element: null },
          { path: '/more',              element: null },
          { path: '/schemas',           element: null },
          { path: '/profile',           element: null },
          { path: '/practice',          element: null },
          { path: '/help',              element: <Navigate to="/practice" replace /> },
          { path: '/exercises',         element: <Navigate to="/practice" replace /> },
          { path: '/cabinet',           element: null },
          { path: '/cabinet/:clientId', element: null },
          { path: '/cabinet/:clientId/:tab', element: null }, // вкладка карточки (therapist/clientTabRoute)
        ],
      },
    ],
  },
  { path: '*',               lazy: notFoundRoute }, // 404 гостю и вошедшему (b26), а не молча на вход или в «Сегодня»
];
// ── Domain detection + router ────────────────────────────────────────────────
// Домен и роутер считаются при первом рендере, а не при импорте модуля: App.test
// подменяет адрес и рендерит App без пересборки всего графа (docs/open/ci-tests.md).
// Кэш по объекту location: в браузере он один — роутер создаётся один раз (и
// StrictMode, дважды зовущий рендер, второго не создаст); в тесте у каждого
// подменённого адреса свой объект — свой роутер.
const routers = new WeakMap<Location, ReturnType<typeof createBrowserRouter>>();

function routerFor(loc: Location) {
  const cached = routers.get(loc);
  if (cached) return cached;
  const isPersonalSite = resolvePersonalSite(loc.hostname, loc.search, import.meta.env.DEV); // S15
  if (isPersonalSite) applyPersonalSiteChrome();
  const router = createBrowserRouter([
    {
      element: <Root personal={isPersonalSite} />,
      errorElement: <RouteErrorScreen />,
      children: isPersonalSite ? personalRoutes : appRoutes,
    },
  ]);
  routers.set(loc, router);
  return router;
}

export default function App() {
  return <RouterProvider router={routerFor(window.location)} />;
}

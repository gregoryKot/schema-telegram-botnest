// Где Яндекс.Метрике можно работать: только публичные страницы сайта
// (витрина, статьи, тесты, юридические, оплата). Решение D-4 (аудит
// 2026-10): кабинет, дневники, письма и прочие экраны за входом счётчик не
// видит вообще — ни хита, ни клика, ни цели.
//
// Список написан по маршрутам `webapp/src/App.tsx` (personalRoutes и
// appRoutes): всё, что не требует входа и не про вход/аккаунт. Сверка с
// App.tsx — в metrikaRoutes.test.ts: новый маршрут без классификации роняет
// тест (правило №4 CLAUDE.md — два реестра, обязанных совпадать).
// Сегментное сравнение, а не startsWith: `/articles-admin` не «статья».

/** Страницы целиком (без хвоста). */
export const METRIKA_PUBLIC_PATHS: ReadonlySet<string> = new Set([
  '/',
  '/articles',
  '/reviews',
  '/tests',
  '/subscribe',
  '/donate',
  '/privacy',
  '/offer',
  '/booking/paid',
  '/booking/manage',
]);

/** Разделы с хвостом: `/articles/:slug`, `/tests/:quizId`. */
export const METRIKA_PUBLIC_PREFIXES: readonly string[] = ['/articles/', '/tests/'];

export function isPublicMetrikaRoute(pathname: string): boolean {
  // Хвостовой слэш не меняет страницу; корень остаётся корнем.
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (METRIKA_PUBLIC_PATHS.has(path)) return true;
  return METRIKA_PUBLIC_PREFIXES.some((p) => path.startsWith(p) && path.length > p.length);
}

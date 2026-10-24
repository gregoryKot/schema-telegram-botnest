// Какой экран показать при error/sessionExpired в App.tsx — вынесено в
// чистую функцию (правило №10, App.tsx заморожен), чтобы разбор случаев был
// виден и покрыт таблицей тестов, а не размазан по JSX.
//
// Инцидент 31.08.2026 (авария БД): каждый запрос отвечал 500, включая
// /api/auth/refresh. classifyRefreshFailure() верно говорил «transient», но
// экран об этом не спрашивал — 401 от данных без Bearer автоматически читался
// как «не удалось войти», и владелец ярлычного приложения увидел подсказку
// про Telegram посреди аварии сервера, которая Telegram вообще не касалась.
export type ErrorScreenKind = 'login' | 'connection' | 'auth-help' | 'generic';

function isAuthError(error: string): boolean {
  return error.includes('401') || error.includes('403');
}

/**
 * @param error строка ошибки, как её увидел App.tsx (`String(e)` или
 *   SESSION_EXPIRED_ERROR).
 * @param isDead `isSessionDead()` — сервер ПОДТВЕРДИЛ отказ (401/403) и мы ещё
 *   в кулдауне повторной попытки.
 * @param lastFailure `lastRenewFailure()` — чем кончилась ПОСЛЕДНЯЯ попытка
 *   перевыпуска (не гаснет с кулдауном, в отличие от `isDead`): 'dead' —
 *   сервер отказал, 'transient' — сеть/5xx, null — попытки не было или она
 *   удалась.
 * @param showLoginOnDead хост показывает экран входа при мёртвой сессии
 *   (веб-хост — `shouldShowLoginScreen()`; в Telegram/MAX своя логика).
 */
export function pickErrorScreen(
  error: string,
  isDead: boolean,
  lastFailure: 'dead' | 'transient' | null,
  showLoginOnDead: boolean,
): ErrorScreenKind {
  if (isDead) return showLoginOnDead ? 'login' : 'auth-help';
  if (isAuthError(error) && lastFailure === 'transient') return 'connection';
  if (isAuthError(error)) return 'auth-help';
  return 'generic';
}

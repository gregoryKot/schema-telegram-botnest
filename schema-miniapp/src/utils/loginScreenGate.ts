import { getHost } from '../../../shared/src/host';

/**
 * В браузере (без хоста-мессенджера) отсутствие сессии значит «человек ещё
 * не входил» — правильный ответ экран входа, а не «Сессия истекла» (это
 * враньё для новичка, который никогда не логинился). В Telegram/MAX
 * отсутствие сессии лечится переоткрытием приложения — там прежний
 * AppErrorScreen остаётся как есть (см. MULTI_HOST_PLAN.md, шаг 2).
 */
export function shouldShowLoginScreen(): boolean {
  return getHost().id === 'web';
}

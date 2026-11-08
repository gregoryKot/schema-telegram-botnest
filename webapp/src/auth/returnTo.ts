// Адрес, с которого человека увели на вход (аудит 2026-11, E14): после входа
// он возвращается туда, а не всегда на «Сегодня». Живёт в sessionStorage
// вкладки — переживает уход на Google, VK или oauth.telegram.org и обратно.
// Вход по ссылке из письма приходит НОВОЙ вкладкой: там адреса нет, человек
// попадает на «Сегодня» (параметр запуска при этом не теряется — у него свой
// путь через localStorage, rememberLaunchParam).
//
// Один модуль на ключ: пишут RequireAuth, LinkDevicePage и привязка способа
// входа; забирают экран входа, 2FA и колбэки (OAuth, Telegram, письмо).
import { useCallback, useRef } from 'react';
import { LAUNCH_KEYS } from '../../../shared/src/host/startParam';

export const AUTH_RETURN_KEY = 'auth_return_to';

/** Опорный адрес для разбора: сравниваем, не уводит ли путь на другой сайт. */
const BASE = 'https://return-to.invalid';

/**
 * Только внутренний путь: начинается с `/` и остаётся на своём сайте.
 * `//evil.com`, `/\evil.com`, `/\t/evil.com` браузер читает как чужой адрес —
 * такой «адрес возврата» сделал бы из входа открытый редирект. Чужое — null.
 * `/..//evil.com` разбор схлопывает в путь `//evil.com` на своём же сайте, а
 * навигация прочла бы его как чужой хост — такой результат тоже null.
 */
export function safeReturnPath(raw: string | null | undefined): string | null {
  if (!raw?.startsWith('/')) return null;
  try {
    const url = new URL(raw, BASE);
    const path = url.pathname + url.search + url.hash;
    return url.origin === BASE && !path.startsWith('//') ? path : null;
  } catch {
    return null;
  }
}

/**
 * Запомнить адрес до входа. Параметр запуска (`?startapp=`) срезается: его
 * ждёт свой механизм со сроком годности, второй копии без срока не нужно.
 * false — не запомнили (чужой адрес или хранилище закрыто, приватный режим):
 * после входа человек попадёт на «Сегодня», как раньше.
 */
export function rememberReturnTo(path: string): boolean {
  const safe = safeReturnPath(path);
  if (!safe) return false;
  const url = new URL(safe, BASE);
  if (LAUNCH_KEYS.some((k) => url.searchParams.has(k))) LAUNCH_KEYS.forEach((k) => url.searchParams.delete(k));
  try {
    sessionStorage.setItem(AUTH_RETURN_KEY, url.pathname + url.search + url.hash);
    return true;
  } catch {
    return false;
  }
}

/** Забрать адрес (один раз): после чтения он стирается. Чужой адрес — null. */
export function takeReturnTo(): string | null {
  const path = peekReturnTo();
  try { sessionStorage.removeItem(AUTH_RETURN_KEY); } catch { /* хранилище закрыто — стирать нечего */ }
  return path;
}

/** Посмотреть адрес, не стирая: его везёт ссылка из письма (emailReturnTo.ts). */
export function peekReturnTo(): string | null {
  try {
    return safeReturnPath(sessionStorage.getItem(AUTH_RETURN_KEY));
  } catch {
    return null;
  }
}

/**
 * Куда вести после входа: запомненный адрес, иначе «Сегодня». Берётся один
 * раз за жизнь экрана — эффект «уже вошёл» и обработчик входа срабатывают
 * оба, и второй вызов не должен увести на /today.
 */
export function useAfterLoginPath(): () => string {
  const taken = useRef<string | null>(null);
  return useCallback(() => (taken.current ??= takeReturnTo() ?? '/today'), []);
}

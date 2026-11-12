// Вынесено из auth.controller.ts / auth-http.util.ts (оба на потолке размера, №10).
// Разбор 31.08.2026, продолжение 2026-09-03. `refresh()` ставил refresh-куку
// только при успешной ротации, а на 401 ничего не чистил (в отличие от
// `logout`, у которого была своя пара `clearCookie`). Клиент по контракту
// (shared/src/auth/sessionRefresh.ts) считает 401 на /api/auth/refresh
// ОКОНЧАТЕЛЬНОЙ смертью сессии и уводит человека на экран входа — а кука
// оставалась в jar и предъявлялась снова при каждом visibilitychange/cold
// start тридцать дней подряд.
import { UnauthorizedException } from '@nestjs/common';
import { CROSS_SITE_COOKIE, REFRESH_COOKIE } from './auth-http.util';

interface CookieRes {
  clearCookie(name: string, opts: { path: string }): void;
}

const LINK_COOKIES = ['link_token']; // незаконченная привязка
/** Стирает refresh-куку, метку кросс-сайтовой сессии и куки привязки: брошенная
 * привязка переживала выход — следующий на этом компьютере входил в чужой аккаунт
 * (аудит 2026-11). Общая точка для `logout` и 401 на `/api/auth/refresh`. */
export function clearCookies(res: CookieRes): void {
  for (const name of [REFRESH_COOKIE, CROSS_SITE_COOKIE, ...LINK_COOKIES])
    res.clearCookie(name, { path: '/api/auth' });
}

/**
 * Сервер отвечает 401 на refresh только когда семья/токен мертвы
 * ОКОНЧАТЕЛЬНО: естественное истечение, истёкший наследник, кража, legacy-
 * гонка (см. refresh-rotation.ts, classifyReuse). «Потерянный ответ» уходит
 * по ветке `recover` с ответом 200 — то есть если сессия ещё жива, сервер
 * сюда не попадает. Поэтому стирание куки на 401 не может убить живую сессию
 * соседней вкладки/устройства, делящих ту же family.
 *
 * Любая ДРУГАЯ ошибка (500 — БД недоступна, баг) сессию не хоронит — кука не
 * трогается, err пробрасывается как есть, клиент повторит рефреш позже.
 */
export function clearCookiesOnAuthFailure(res: CookieRes, err: unknown): never {
  if (err instanceof UnauthorizedException) clearCookies(res);
  throw err;
}

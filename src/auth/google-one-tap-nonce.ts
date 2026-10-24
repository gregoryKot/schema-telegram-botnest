// Привязка id_token Google One Tap к браузеру, который его запросил (nonce).
//
// Аудит 2026-10, B-16: One Tap принимал любой валидный id_token с нашим aud —
// токен, снятый у человека (расширение, чужая страница с тем же client_id,
// лог), можно было предъявить с любого браузера. Теперь перед показом
// всплывашки страница просит nonce: сервер кладёт в httpOnly-куку случайный
// секрет, а странице отдаёт его SHA-256. Страница передаёт хеш в GIS (`nonce`),
// Google вписывает его в id_token, а при входе сервер сверяет claim с хешем
// куки. Токен без куки того же браузера бесполезен. Хешируем, а не отдаём сам
// секрет, чтобы то, что уходит в id_token (а значит, к Google и в логи), не
// годилось как значение куки.
import { UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import type { Response } from 'express';
import { OAUTH_COOKIE_PATH, setOAuthCookie } from './oauth-host';

export const GSI_NONCE_COOKIE = 'gsi_nonce';

const sha256Hex = (s: string): string =>
  crypto.createHash('sha256').update(s).digest('hex');

/** Ставит куку с секретом (10 минут, lax, path /api/auth) и отдаёт nonce. */
export function issueOneTapNonce(res: Response): { nonce: string } {
  const secret = crypto.randomBytes(32).toString('base64url');
  setOAuthCookie(res, GSI_NONCE_COOKIE, secret);
  return { nonce: sha256Hex(secret) };
}

export function clearOneTapNonce(res: Pick<Response, 'clearCookie'>): void {
  res.clearCookie(GSI_NONCE_COOKIE, { path: OAUTH_COOKIE_PATH });
}

/**
 * Сверка claim `nonce` из id_token с кукой. Отказ — и когда нет куки, и когда
 * нет claim, и когда не совпало (причину наружу не различаем).
 *
 * `offline` (JWKS Google недоступен, подпись не проверена) для One Tap
 * недопустим: офлайн-путь держится на том, что токен получен нашим же POST'ом
 * от Google по TLS, а здесь его прислал браузер — без проверки подписи
 * подделать claims мог бы кто угодно.
 */
export function assertOneTapNonce(
  claims: { nonce?: string; offline: boolean },
  cookie: string | undefined,
): void {
  if (claims.offline || !cookie || !claims.nonce) {
    throw new UnauthorizedException('Google One Tap nonce invalid');
  }
  const expected = Buffer.from(sha256Hex(cookie));
  const actual = Buffer.from(claims.nonce);
  if (
    expected.length !== actual.length ||
    !crypto.timingSafeEqual(expected, actual)
  ) {
    throw new UnauthorizedException('Google One Tap nonce invalid');
  }
}

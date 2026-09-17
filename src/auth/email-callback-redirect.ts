// Куда уводить человека, если переход по ссылке из письма не сработал.
//
// Раньше любой сбой отправлял на экран «ссылка истекла». Для занятого адреса
// это неправда: ссылка жива, а адрес уже привязан к другому аккаунту. Человек
// шёл запрашивать письмо заново и получал то же самое — снова и снова.
//
// Побочно чинится второй дефект: конфликт привязки уезжал на экран ошибки
// ВХОДА, который отчитывается наверх через useAuthFailureReport, и попадал
// в отчёт «Вход в мессенджере» как отказ входа. Он им не был.
//
// Существование чужого аккаунта это не раскрывает: тот же самый текст уже
// отдаётся синхронно на шаге запроса привязки (email/link-to-account под
// JwtAuthGuard и троттлингом), а письмо приходит только на введённый адрес.
import { ConflictException } from '@nestjs/common';

/** Успешный переход: привязка возвращает на аккаунт, вход — на приём сессии. */
export function emailCallbackSuccessUrl(
  purpose: string,
  frontendBase: string,
  tokens: { accessToken: string; expiresIn: number },
): string {
  if (purpose === 'link_email_auth')
    return `${frontendBase}/account?linked=email`;
  return (
    `${frontendBase}/auth/callback#access_token=${tokens.accessToken}` +
    `&expires_in=${tokens.expiresIn}`
  );
}

/**
 * Куда вести браузер, когда вход по письму нёс билет (`?ticket=`). Билет
 * больше НЕ одобряется молча (device-code phishing, разбор 2026-08-31): уже
 * вошедшего человека уводим на экран сверки, где он сам подтвердит код своей
 * сессией. Нет билета — обычный приём сессии.
 */
export function emailCallbackNextUrl(
  purpose: string,
  frontendBase: string,
  tokens: { accessToken: string; expiresIn: number },
  ticket: string | null,
): string {
  if (purpose === 'link_email_auth' || !ticket)
    return emailCallbackSuccessUrl(purpose, frontendBase, tokens);
  return (
    `${frontendBase}/auth/confirm?code=${encodeURIComponent(ticket)}` +
    `#access_token=${tokens.accessToken}&expires_in=${tokens.expiresIn}`
  );
}

export function emailCallbackErrorUrl(err: unknown, frontendBase: string) {
  if (err instanceof ConflictException) {
    return `${frontendBase}/account?error=email_taken`;
  }
  return `${frontendBase}/auth/error?reason=email_link_expired`;
}

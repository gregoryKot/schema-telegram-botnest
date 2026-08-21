// Билдер URL логин-виджета Telegram — общий для боевого редиректа
// (AuthTelegramController.telegramRedirect) и сторожка
// (TelegramDomainWatchdogService). Инцидент 2026-08-08 научил: тест/проверка
// обязаны идти через настоящий код, а не через свою копию допущений — иначе
// сторожок мог бы «здороветь» на URL, который пользователь на самом деле не
// видит. Здесь один источник строки для обоих потребителей.

/** URL полностраничного логина через oauth.telegram.org/auth. */
export function telegramOauthLoginUrl(
  botId: string,
  frontendBase: string,
): string {
  const returnTo = `${frontendBase}/auth/telegram`;
  return `https://oauth.telegram.org/auth?bot_id=${botId}&origin=${encodeURIComponent(frontendBase)}&return_to=${encodeURIComponent(returnTo)}&request_access=write&lang=ru&embed=0`;
}

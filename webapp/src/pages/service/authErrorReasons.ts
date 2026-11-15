// Причины на экране `/auth/error` — словарь кодов, которые реально ставим мы
// (S20, аудит 2026-11). Раньше экран выводил `?reason=` как есть и отправлял
// его в отчёт админу: ссылку `/auth/error?reason=<любой текст>` мог прислать
// кто угодно, и этот текст стоял на нашей странице под нашим знаком.
//
// Откуда коды (сверять при добавлении нового редиректа на `/auth/error`):
// - `<провайдер>_failed` — колбэки OAuth в `src/auth/auth-oauth.controller.ts`
//   (`vk_failed`, `yandex_failed`); id провайдеров — `src/auth/providers/*.provider.ts`;
// - `<провайдер>_disabled` — `src/auth/oauth-provider-switch.ts` (env провайдера
//   снят: рубильник входа; сверку словаря держит `oauth-provider-switch.spec.ts`);
// - `email_link_expired` — `src/auth/email-callback-redirect.ts` и
//   `pages/authCallback/consumeEmailToken.ts`; там же `email_network` (запрос
//   не дошёл до сервера) и `http_429`/`http_5xx` (ответил, но не про ссылку).
// Кодов `telegram_*` нет с 2026-11: входа через Telegram на сайте нет.
// Неизвестное — общий текст, сам код не показываем, в отчёт уходит `unknown`.
//
// Тексты безличные: экран живёт вне AddressFormProvider, формы взять неоткуда.

const providerFailed = (name: string) =>
  `Вход через ${name} не прошёл. Можно повторить попытку или выбрать другой способ.`;

// Другой вход на сайте один — второй сервис; почтой не входят.
const providerDisabled = (name: string, other: string) =>
  `Вход через ${name} временно отключён. Если к аккаунту привязан ${other}, войти можно через него.`;

const AUTH_ERROR_TEXTS: Record<string, string> = {
  vk_failed: providerFailed('ВКонтакте'),
  vk_disabled: providerDisabled('ВКонтакте', 'Яндекс ID'),
  yandex_failed: providerFailed('Яндекс'),
  yandex_disabled: providerDisabled('Яндекс', 'VK ID'),
  max_failed: providerFailed('MAX'),
  email_link_expired:
    'Ссылка из письма действует 30 минут и открывается только один раз. Новую можно запросить в «Аккаунте».',
  email_network:
    'Запрос не дошёл до сервера, ссылка из письма цела. Когда интернет вернётся, её можно открыть ещё раз.',
};

const HTTP_REASON = /^http_[1-5]\d\d$/;

/** Код из словаря (или `http_<статус>`); всё остальное — `null`. */
export function knownAuthErrorReason(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (Object.prototype.hasOwnProperty.call(AUTH_ERROR_TEXTS, raw)) return raw;
  return HTTP_REASON.test(raw) ? raw : null;
}

/** Что уйдёт в отчёт: известный код или `unknown`; без причины — отчёта нет. */
export function reportedAuthErrorReason(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return knownAuthErrorReason(raw) ?? 'unknown';
}

/** Пояснение для человека; для неизвестного кода — `null` (общий текст экрана). */
export function authErrorText(code: string | null): string | null {
  if (!code) return null;
  if (Object.prototype.hasOwnProperty.call(AUTH_ERROR_TEXTS, code)) return AUTH_ERROR_TEXTS[code];
  if (code === 'http_429') return 'Слишком много попыток подряд. Через пару минут можно попробовать снова.';
  if (code.startsWith('http_5')) return 'Сервер сейчас не отвечает — обычно это проходит за несколько минут.';
  return null;
}

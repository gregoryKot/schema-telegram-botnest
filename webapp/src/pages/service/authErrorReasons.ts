// Причины на экране `/auth/error` — словарь кодов, которые реально ставим мы
// (S20, аудит 2026-11). Раньше экран выводил `?reason=` как есть и отправлял
// его в отчёт админу: ссылку `/auth/error?reason=<любой текст>` мог прислать
// кто угодно, и этот текст стоял на нашей странице под нашим знаком.
//
// Откуда коды (сверять при добавлении нового редиректа на `/auth/error`):
// - `<провайдер>_failed` — `src/auth/auth-flow.service.ts` (колбэк OAuth),
//   `src/auth/auth-oauth.controller.ts` (`vk_failed`); id провайдеров —
//   `src/auth/providers/*.provider.ts`;
// - `<провайдер>_disabled` — `src/auth/oauth-provider-switch.ts` (env провайдера
//   снят: рубильник входа; сверку словаря держит `oauth-provider-switch.spec.ts`);
// - `email_link_expired` — `src/auth/email-callback-redirect.ts` и
//   `pages/authCallback/consumeEmailToken.ts`; там же `email_network` (запрос
//   не дошёл до сервера) и `http_429`/`http_5xx` (ответил, но не про ссылку);
// - `telegram_*` и `http_<статус>` — `pages/TelegramWidgetCallback.tsx`
//   (ответ сервера переводится в код там же, `telegramWidgetReason`).
// Неизвестное — общий текст, сам код не показываем, в отчёт уходит `unknown`.

type Tr = (ty: string, vy: string) => string;

const providerFailed = (name: string) => (tr: Tr) =>
  tr(
    `Вход через ${name} не прошёл. Попробуй ещё раз или выбери другой способ.`,
    `Вход через ${name} не прошёл. Попробуйте ещё раз или выберите другой способ.`,
  );

// Безличный: экран публичный, формы обращения у него нет (как у DonatePage).
const providerDisabled = (name: string) => () =>
  `Вход через ${name} временно отключён. Другой способ — Telegram или почта: ` +
  'если они привязаны к аккаунту, откроется он же.';

const tryAgain = (lead: string) => (tr: Tr) =>
  `${lead} ${tr('Попробуй ещё раз.', 'Попробуйте ещё раз.')}`;

const AUTH_ERROR_TEXTS: Record<string, (tr: Tr) => string> = {
  google_failed: providerFailed('Google'),
  vk_failed: providerFailed('ВКонтакте'),
  google_disabled: providerDisabled('Google'),
  vk_disabled: providerDisabled('ВКонтакте'),
  max_failed: providerFailed('MAX'),
  telegram_failed: providerFailed('Telegram'),
  telegram_no_data: tryAgain('Данные входа от Telegram не дошли до сайта.'),
  telegram_decode_error: tryAgain('Данные входа от Telegram пришли повреждёнными.'),
  telegram_unexpected_response: tryAgain('Сервер ответил на вход через Telegram чем-то непонятным.'),
  telegram_expired: tryAgain('Данные входа от Telegram устарели: окно входа было открыто слишком долго.'),
  email_link_expired: (tr) =>
    tr(
      'Ссылка из письма действует 30 минут и открывается только один раз. Запроси новую.',
      'Ссылка из письма действует 30 минут и открывается только один раз. Запросите новую.',
    ),
  email_network: (tr) =>
    tr(
      'Нет связи, попробуй ещё раз: проверь интернет и снова открой ссылку из письма.',
      'Нет связи, попробуйте ещё раз: проверьте интернет и снова откройте ссылку из письма.',
    ),
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
export function authErrorText(code: string | null, tr: Tr): string | null {
  if (!code) return null;
  const text = AUTH_ERROR_TEXTS[code];
  if (text) return text(tr);
  if (code === 'http_429') {
    return tr(
      'Слишком много попыток подряд. Подожди пару минут и попробуй снова.',
      'Слишком много попыток подряд. Подождите пару минут и попробуйте снова.',
    );
  }
  if (code.startsWith('http_5')) {
    return tr(
      'Сервер сейчас не отвечает. Попробуй через несколько минут.',
      'Сервер сейчас не отвечает. Попробуйте через несколько минут.',
    );
  }
  return null;
}

// Ответ сервера на POST /api/auth/telegram/widget → код для адреса. Текст
// ошибки сервера в адрес больше не кладём: экран его не покажет, а отчёт
// получит только код. Отдельно — устаревшие данные: это частый и понятный
// человеку случай (`src/auth/providers/telegram.provider.ts`).
export function telegramWidgetReason(status: number, message: unknown): string {
  if (message === 'Telegram auth data expired') return 'telegram_expired';
  return `http_${status}`;
}

// Роут-методы под OptionalJwtGuard: аноним проходит, сессия (если есть) лишь
// говорит, к какому аккаунту привязать вход. До 2026-11 трипваер route-auth
// засчитывал OptionalJwtGuard как защиту, и шесть роутов входа числились
// guarded. Теперь такой метод назван здесь с тем, что его на самом деле
// держит; новый optional-роут без записи и протухшая запись роняют
// route-auth.invariants.spec.ts. Ключ — `файл:метод`, как в
// ANONYMOUS_BY_DESIGN (anonymous-routes.ts). Список может только сокращаться,
// добавлять — с ревью безопасности.
export const OPTIONAL_AUTH_BY_DESIGN: Record<string, string> = {
  'auth/auth-account.controller.ts:confirmMerge':
    'слияние аккаунтов: CSRF-заголовок, подписанный merge-токен, сверка ' +
    'вызывающего с целевым аккаунтом (assertMergeCaller: Bearer или refresh-кука), ' +
    'TOTP поглощаемого, счётчик в Postgres',
  'auth/auth-oauth.controller.ts:vkRedirect':
    'старт входа через VK: ничего не проверяет и данных не отдаёт — ' +
    'подписывает state (с linkUserId, если сессия есть), кладёт его в куку ' +
    '(плюс PKCE) и отвечает 302 на провайдера; сверяет vkCallback',
  'auth/auth-oauth.controller.ts:yandexRedirect':
    'старт входа через Яндекс ID (2026-11), как vkRedirect: подписывает state ' +
    '(с linkUserId, если есть кука link_token), кладёт его в куку и отвечает ' +
    '302 на провайдера; сверяет yandexCallback',
  'auth/auth-ticket.controller.ts:start':
    'билет входа для контейнера: выдаёт device-код, троттлинг по IP; ' +
    'intent link без сессии — 401, вход сессию не наследует',
};

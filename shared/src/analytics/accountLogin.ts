// События входа и переноса аккаунта (правило №8). Парный allow-list — ANALYTICS_EVENTS
// (src/analytics/analytics.constants.ts); значения сверяет analytics-sync.invariants.spec.ts.

// Перенос аккаунта (device-link, RFC 8628): начало и подтверждение шлёт фронт,
// неудачу (account_link_failed) пишет сервер — trackLinkFailed в src/telegram/.
export const ACCOUNT_LINK_STARTED_EVENT = 'account_link_started';
export const ACCOUNT_LINK_CONFIRMED_EVENT = 'account_link_confirmed';

/** Откуда переносят: meta.host. 'web' — карточка объединения на сайте. */
export type AccountLinkHost = 'max' | 'telegram' | 'web';

// Приглашение добавить VK ID или Яндекс ID внутри Telegram (SiteAccessCard): meta { action }.
// Allow-list действий — src/analytics/login-method-offer.constants.ts.
export const LOGIN_METHOD_OFFER_EVENT = 'login_method_offer';

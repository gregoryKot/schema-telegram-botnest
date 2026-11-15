// События входа и переноса аккаунта (правило №8). Парный allow-list — ANALYTICS_EVENTS
// (src/analytics/analytics.constants.ts); значения сверяет analytics-sync.invariants.spec.ts.

// Перенос аккаунта из мессенджера (device-link, RFC 8628). Путь идёт через внешний
// браузер, поэтому меряются все три точки: начал в мессенджере, подтвердил в браузере,
// не вышло. Без последней «сколько людей не смогли» не измерить.
export const ACCOUNT_LINK_STARTED_EVENT = 'account_link_started';
export const ACCOUNT_LINK_CONFIRMED_EVENT = 'account_link_confirmed';
export const ACCOUNT_LINK_FAILED_EVENT = 'account_link_failed';

/** Откуда переносят: meta.host. 'web' — карточка объединения на сайте. */
export type AccountLinkHost = 'max' | 'telegram' | 'web';
/** Почему не вышло: meta.reason. */
export type AccountLinkFailReason = 'expired' | 'error';

// Приглашение добавить VK ID или Яндекс ID внутри Telegram (SiteAccessCard): meta { action }.
// Allow-list действий — src/analytics/login-method-offer.constants.ts.
export const LOGIN_METHOD_OFFER_EVENT = 'login_method_offer';

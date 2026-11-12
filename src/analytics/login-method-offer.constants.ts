// Событие login_method_offer: приглашение добавить почту или VK ID тому, кто
// открывает приложение только внутри Telegram (карточка SiteAccessCard,
// webapp/src/components/SiteAccessCard.tsx). Входа через Telegram на сайте нет
// с 2026-11 — без второго способа такой человек на сайт не попадёт.
// Отдельным файлом: analytics.constants.ts сверх лимита и обязан таять (№10).
export const LOGIN_METHOD_OFFER_ACTIONS = [
  /** Карточку показали (раз на открытие экрана). */
  'shown',
  /** Нажал «Добавить почту или VK ID» — ушёл на экран способов входа. */
  'open',
  /** Нажал «Позже» — карточка вернётся через неделю. */
  'later',
] as const;
export type LoginMethodOfferAction =
  (typeof LOGIN_METHOD_OFFER_ACTIONS)[number];

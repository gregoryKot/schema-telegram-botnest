// События уведомлений в приложении (веб-пуши, src/push/). Реестр рядом с
// фичей — правило №10, тот же приём, что у CASE_EVENTS.
//
//   push_subscribed   — человек включил уведомления в приложении: подписка
//                       сохранена, пробное уведомление ушло (meta.delivered —
//                       принял ли его push-сервис, meta.service — PUSH_SERVICES).
//                       Пишет только сервер (PushService.subscribe).
//   push_unsubscribed — выключил (meta.reason: 'user' — сам, 'logout' — выход
//                       из аккаунта). Пишет только сервер (PushService.unsubscribe).
//   push_gone         — push-сервис ответил, что подписки больше нет (браузер
//                       отозвал разрешение, приложение удалено), и сервер её
//                       удалил (meta.service). Пишет очередь / пробная отправка.
//   push_denied       — человек отказал в разрешении браузера. Шлёт КЛИЕНТ
//                       (POST /api/event, без meta; shared/src/share/analytics.ts).
//
// Серверные три с клиента приходят без meta (analytics-meta.sanitize-push.ts),
// а /stats считает только строки с meta — подделка через POST /api/event в
// отчёт не попадает.
export const PUSH_EVENTS = [
  'push_subscribed',
  'push_unsubscribed',
  'push_gone',
  'push_denied',
] as const;
export type PushEventName = (typeof PUSH_EVENTS)[number];

export const PUSH_UNSUBSCRIBE_REASONS = ['user', 'logout'] as const;
export type PushUnsubscribeReason = (typeof PUSH_UNSUBSCRIBE_REASONS)[number];

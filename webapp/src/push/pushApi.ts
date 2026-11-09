// Ручки веб-пушей (контракт — docs/PWA_PLAN.md, фаза 4). Обе записи меняют
// notifyChannel в GET /api/settings — его ключ кеша сбрасывает карта
// shared/src/api/apiCacheRules.data.ts, перечитанные настройки свежие.
import { get, post, postJson } from '../apiClient';

export interface PushSubscriptionBody {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/** 'logout' — выход или удаление аккаунта: подписка уходит вместе с сессией. */
export type PushUnsubscribeReason = 'user' | 'logout';

export const pushApi = {
  /** publicKey === null — на сервере нет VAPID-ключей: включение не предлагаем. */
  config: () => get<{ publicKey: string | null }>('/api/push/config'),
  /** Сохраняет подписку и шлёт пробный пуш; delivered — дошёл ли он до push-сервиса. */
  subscribe: (body: PushSubscriptionBody) =>
    postJson<{ ok: true; delivered: boolean }>('/api/push/subscription', body),
  unsubscribe: (endpoint: string, reason: PushUnsubscribeReason) =>
    post('/api/push/unsubscribe', { endpoint, reason }),
};

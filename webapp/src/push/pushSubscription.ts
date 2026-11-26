// Включение и выключение веб-пушей на этом устройстве (docs/PWA_PLAN.md, 4.7).
// Разрешение браузера спрашивается ТОЛЬКО по клику (enablePush зовёт тумблер
// «На этом устройстве»): окно-запрос на загрузке раздражает, и браузеры его глушат.
// Воркер (webapp/public/sw.js) регистрируется здесь же — не на каждой загрузке.
import { api } from '../api';
import { base64UrlToBytes } from '../../../shared/src/utils/base64url';
import { PUSH_DENIED_EVENT } from '../../../shared/src/share/analytics';
import { pushApi, type PushSubscriptionBody } from './pushApi';
import { currentPushSubscription } from './pushState';

export type EnableOutcome =
  | { kind: 'on'; delivered: boolean }
  | { kind: 'denied' } // запретили в окне браузера
  | { kind: 'dismissed' } // закрыли окно, не ответив
  | { kind: 'error' }; // сеть, 400, 503, отказ push-сервиса

const READY_TIMEOUT_MS = 15_000;
const LOGOUT_TIMEOUT_MS = 5_000; // выход не ждёт сеть дольше этого

export function subscriptionBody(sub: PushSubscription): PushSubscriptionBody | null {
  const { endpoint, keys } = sub.toJSON();
  if (!endpoint || !keys?.p256dh || !keys.auth) return null;
  return { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } };
}

/** Подписка сделана текущим ключом сервера? Ключ сменили — старая мертва. */
export function sameServerKey(sub: PushSubscription, key: Uint8Array): boolean {
  const current = sub.options?.applicationServerKey;
  if (!current) return false;
  const bytes = new Uint8Array(current);
  return bytes.length === key.length && bytes.every((b, i) => b === key[i]);
}

function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`push: ${what} — нет ответа за ${ms} мс`)), ms);
    p.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e: unknown) => { clearTimeout(timer); reject(e); },
    );
  });
}

async function browserSubscription(publicKey: string): Promise<PushSubscription> {
  await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  const reg = await withTimeout(navigator.serviceWorker.ready, READY_TIMEOUT_MS, 'воркер');
  const key = base64UrlToBytes(publicKey);
  const existing = await reg.pushManager.getSubscription();
  if (existing && sameServerKey(existing, key)) return existing;
  if (existing) await existing.unsubscribe();
  return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
}

async function dropBrowserSubscription(sub: PushSubscription): Promise<void> {
  try {
    await sub.unsubscribe();
  } catch (e) {
    console.warn('push: подписку в браузере снять не удалось', e);
  }
}

export async function enablePush(publicKey: string): Promise<EnableOutcome> {
  const permission = await Notification.requestPermission();
  if (permission === 'denied') {
    api.trackEvent(PUSH_DENIED_EVENT);
    return { kind: 'denied' };
  }
  if (permission !== 'granted') return { kind: 'dismissed' };
  let sub: PushSubscription | null = null;
  try {
    sub = await browserSubscription(publicKey);
    const body = subscriptionBody(sub);
    if (!body) throw new Error('push: у подписки нет ключей');
    const { delivered } = await pushApi.subscribe(body);
    return { kind: 'on', delivered };
  } catch (e) {
    console.error('push: включить не удалось', e);
    // Сервер подписку не принял — браузерная не должна изображать «включено».
    if (sub) await dropBrowserSubscription(sub);
    return { kind: 'error' };
  }
}

/** Выключить тумблером. Сервер не ответил — бросает, подписка остаётся:
 *  уведомления идут, экран честно показывает «включено» и ошибку. */
export async function disablePush(): Promise<void> {
  const sub = await currentPushSubscription();
  if (!sub) return;
  await pushApi.unsubscribe(sub.endpoint, 'user');
  await sub.unsubscribe();
}

/**
 * Выход: до очистки сессии сервер забывает подписку этого браузера — иначе
 * следующий аккаунт здесь получал бы чужие напоминания. Best-effort: сеть и
 * отказ сервера выход не роняют, а ждёт он не дольше LOGOUT_TIMEOUT_MS.
 */
export async function releasePushOnLogout(): Promise<void> {
  const sub = await currentPushSubscription();
  if (!sub) return;
  try {
    await withTimeout(pushApi.unsubscribe(sub.endpoint, 'logout'), LOGOUT_TIMEOUT_MS, 'отписка при выходе');
  } catch (e) {
    console.warn('push: сервер не подтвердил отписку при выходе', e);
  }
  await dropBrowserSubscription(sub);
}

/** Аккаунт удалён: подписки на сервере ушли вместе с ним, снять браузерную. */
export async function dropPushAfterAccountDeletion(): Promise<void> {
  const sub = await currentPushSubscription();
  if (sub) await dropBrowserSubscription(sub);
}

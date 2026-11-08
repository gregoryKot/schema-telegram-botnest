// Веб-пуши на этом устройстве (docs/PWA_PLAN.md, фаза 4, п. 4.7): что показать
// в «Настройках → Уведомления». Решение — чистая функция pushDeviceState() от
// снимка окружения; снимок читают тонкие обёртки над браузерным API ниже.
// Включение и выключение — pushSubscription.ts, хук экрана — usePushDevice.ts.
import { getHost } from '../../../shared/src/host';
import { isStandalone, webPlatform } from '../../../shared/src/host/web';

/**
 * - unsupported — пушей тут нет: вебвью Telegram/MAX, старый браузер или на
 *   сервере нет VAPID-ключей (publicKey === null);
 * - ios-install — iPhone/iPad во вкладке Safari: пуши приходят только в
 *   приложение с экрана «Домой» (iOS 16.4+);
 * - denied — уведомления для сайта запрещены в настройках браузера;
 * - off / on — подписки на этом устройстве нет / есть.
 */
export type PushDeviceState = 'unsupported' | 'ios-install' | 'denied' | 'off' | 'on';

export interface PushEnv {
  /** getHost().id: 'web' — браузер или установленное приложение. */
  hostId: string;
  /** webPlatform(): 'ios' | 'android' | 'web'. */
  platform: string;
  standalone: boolean;
  /** Есть serviceWorker, PushManager и Notification. */
  apis: boolean;
  permission: NotificationPermission | null;
}

/** Что ясно без ключа сервера и подписки; null — нужно спросить дальше. */
export function preliminaryPushState(env: PushEnv): PushDeviceState | null {
  // Вебвью мессенджера: даже если API есть (Telegram Desktop), окно живёт до
  // закрытия мини-приложения — подписка из него пропадёт вместе с ним.
  if (env.hostId !== 'web') return 'unsupported';
  // Во вкладке Safari PushManager нет вовсе — без этой ветки iPhone попал бы
  // в «не поддерживается», хотя после установки на экран пуши работают.
  if (env.platform === 'ios' && !env.standalone) return 'ios-install';
  return env.apis ? null : 'unsupported';
}

export function pushDeviceState(env: PushEnv, publicKey: string | null, subscribed: boolean): PushDeviceState {
  if (publicKey === null) return 'unsupported';
  const early = preliminaryPushState(env);
  if (early) return early;
  if (env.permission === 'denied') return 'denied';
  return subscribed ? 'on' : 'off';
}

/**
 * Сверка с сервером: подписка в браузере есть, а канал не push — сервер её
 * забыл (сменили ключ VAPID, push-сервис ответил «нет такой»). Показываем
 * «выключено»: включение переотправит подписку, а не будет врать «приходят сюда».
 */
export function reconcilePushState(state: PushDeviceState | null, channel: 'push' | 'telegram' | null): PushDeviceState | null {
  return state === 'on' && channel !== 'push' ? 'off' : state;
}

export function hasPushApis(): boolean {
  return (
    typeof navigator !== 'undefined' && 'serviceWorker' in navigator &&
    typeof window !== 'undefined' && 'PushManager' in window && 'Notification' in window
  );
}

export function readPushEnv(): PushEnv {
  const apis = hasPushApis();
  return {
    hostId: getHost().id,
    platform: webPlatform(),
    standalone: isStandalone(),
    apis,
    permission: apis ? Notification.permission : null,
  };
}

/**
 * Подписка этого браузера. Воркер регистрируется только при включении
 * (pushSubscription.ts), поэтому здесь регистрацию лишь ищут — не создают.
 */
export async function currentPushSubscription(): Promise<PushSubscription | null> {
  if (!hasPushApis()) return null;
  try {
    const reg = await navigator.serviceWorker.getRegistration('/');
    return (await reg?.pushManager.getSubscription()) ?? null;
  } catch (e) {
    console.warn('push: подписку прочитать не удалось', e);
    return null;
  }
}

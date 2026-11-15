// Telegram Web и MAX в браузере держат сайт во фрейме (src/security/embedders.ts): кука SameSite=Lax
// там не ставится, а VK ID и Яндекс ID во фрейме не открываются — уход по редиректу обрывается молча.
import { getHost } from './index';
import { launchPlatform, type LaunchPlatform } from './launchPlatform';
import type { HostBridge, HostId } from './types';

export type FrameMessenger = Exclude<HostId, 'web'>;

/** Платформы веб-клиентов: Telegram Web (K, A и старый) и MAX в браузере. */
const WEB_CLIENTS: ReadonlySet<LaunchPlatform> = new Set([
  'web',
  'weba',
  'webk',
]);

/**
 * В каком мессенджере сайт открыт во фрейме; null — обычный браузер или нативный клиент.
 * Хватает одного признака: платформы веб-клиента или чужого окна сверху.
 */
export function messengerFrame(
  host: Pick<HostBridge, 'id' | 'platform'> = getHost(),
  win: Pick<Window, 'top' | 'self'> | undefined = globalThis.window,
): FrameMessenger | null {
  if (host.id === 'web') return null;
  const framed = !!win && win.top !== win.self;
  return framed || WEB_CLIENTS.has(launchPlatform(host.platform))
    ? host.id
    : null;
}

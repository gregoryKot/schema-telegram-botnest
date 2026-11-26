import { Probe } from './types';
import { vkOAuthProbe } from './probe-oauth-providers';
import { yandexOAuthProbe } from './probe-yandex-oauth';

/**
 * Живые пробы входа через внешние сервисы: VK ID и Яндекс ID.
 * Вынесены из registry.live.ts, чтобы файл с перечнем проб не рос (правило №10).
 */
export function oauthProbes(): Probe[] {
  return [vkOAuthProbe(), yandexOAuthProbe()];
}

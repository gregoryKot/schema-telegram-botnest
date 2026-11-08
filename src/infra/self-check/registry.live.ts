import { Probe } from './types';
import { telegramProbes } from './probe-telegram-polling';
import { caldavProbe } from './probe-caldav';
import { ciRunsProbe } from './probe-ci-runs';
import { dependabotPrsProbe } from './probe-dependabot-prs';
import { backupFreshnessProbe } from './probe-backup-freshness';
import { googleOAuthProbe, vkOAuthProbe } from './probe-oauth-providers';
import { webPushProbe } from './probe-web-push';
import { telegramDomainProbe } from './probe-telegram-domain';

/**
 * Пробы, которые ходят во внешние площадки живым запросом (Telegram, iCloud,
 * Google, VK, GitHub, Cloudflare R2, push-сервис) — всё, что не про нашу БД и конфигурацию.
 * Вынесены из registry.ts: тот под храповиком размера (правило №10).
 */
export function liveIntegrationProbes(): Probe[] {
  return [
    ...telegramProbes(),
    telegramDomainProbe(),
    caldavProbe(),
    googleOAuthProbe(),
    vkOAuthProbe(),
    ciRunsProbe(),
    dependabotPrsProbe(),
    backupFreshnessProbe(),
    webPushProbe(),
  ];
}

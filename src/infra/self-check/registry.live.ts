import { Probe } from './types';
import { telegramProbe } from './probe-telegram';
import { caldavProbe } from './probe-caldav';
import { ciRunsProbe } from './probe-ci-runs';
import { backupFreshnessProbe } from './probe-backup-freshness';
import { googleOAuthProbe, vkOAuthProbe } from './probe-oauth-providers';

/**
 * Пробы, которые ходят во внешние площадки живым запросом (Telegram, iCloud,
 * Google, VK, GitHub, Backblaze B2) — всё, что не про нашу БД и конфигурацию.
 * Вынесены из registry.ts: тот под храповиком размера (правило №10).
 */
export function liveIntegrationProbes(): Probe[] {
  return [
    telegramProbe(),
    caldavProbe(),
    googleOAuthProbe(),
    vkOAuthProbe(),
    ciRunsProbe(),
    backupFreshnessProbe(),
  ];
}

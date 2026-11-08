import { Probe } from './types';
import { telegramProbes } from './probe-telegram-polling';
import { caldavProbe } from './probe-caldav';
import { ciRunsProbe } from './probe-ci-runs';
import { dependabotPrsProbe } from './probe-dependabot-prs';
import { backupFreshnessProbe } from './probe-backup-freshness';
import { googleOAuthProbe, vkOAuthProbe } from './probe-oauth-providers';
import { webPushProbe } from './probe-web-push';
import { telegramDomainProbe } from './probe-telegram-domain';
import { maxProbe } from './probe-max';

/** Пробы с живым запросом во внешние площадки — не про нашу БД и конфигурацию. */
export function liveIntegrationProbes(): Probe[] {
  return [
    ...telegramProbes(),
    telegramDomainProbe(),
    maxProbe(),
    caldavProbe(),
    googleOAuthProbe(),
    vkOAuthProbe(),
    ciRunsProbe(),
    dependabotPrsProbe(),
    backupFreshnessProbe(),
    webPushProbe(),
  ];
}

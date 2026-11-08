import { buildProbes } from './registry';
import type { PrismaService } from '../../prisma/prisma.service';

describe('buildProbes', () => {
  it('собирает все 21 пробу с уникальными id', () => {
    const probes = buildProbes({} as unknown as PrismaService);
    const ids = probes.map((p) => p.id);
    expect(ids.sort()).toEqual(
      [
        'alerts',
        'backupFreshness',
        'caldav',
        'clinicalLabels',
        'ciRuns',
        'clientIp',
        'cronLeases',
        'db',
        'dependabotPrs',
        'email',
        'encryptionReadable',
        'googleOAuth',
        'max',
        'oauthRedirects',
        'paymentWebhooks',
        'robokassa',
        'runtimeMode',
        'telegram',
        'telegramDomain',
        'telegramPolling',
        'throttleStorage',
        'vkOAuth',
        'webPush',
      ].sort(),
    );
    expect(new Set(ids).size).toBe(ids.length);
  });

  // Probe.retryOnce (types.ts): повтор — только живым запросам к стороннему
  // хосту. ciRuns в списке нет намеренно: лимит REST GitHub без токена.
  it('повтор после вспышки связи — ровно у проб с живым внешним запросом', () => {
    const retried = buildProbes({} as unknown as PrismaService)
      .filter((p) => p.retryOnce)
      .map((p) => p.id)
      .sort();
    expect(retried).toEqual(
      [
        'backupFreshness',
        'caldav',
        'googleOAuth',
        'max',
        'telegram',
        'telegramDomain',
        'vkOAuth',
        'webPush',
      ].sort(),
    );
  });
});

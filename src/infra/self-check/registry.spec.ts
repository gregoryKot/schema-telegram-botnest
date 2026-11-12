import { buildProbes } from './registry';
import type { PrismaService } from '../../prisma/prisma.service';

describe('buildProbes', () => {
  it('собирает все 23 пробы с уникальными id', () => {
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
        'max',
        'oauthRedirects',
        'paymentWebhooks',
        'postbox',
        'robokassa',
        'runtimeMode',
        'telegram',
        'telegramPolling',
        'throttleStorage',
        'vkOAuth',
        'webPush',
        'yandexOAuth',
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
        'max',
        'postbox',
        'telegram',
        'vkOAuth',
        'webPush',
        'yandexOAuth',
      ].sort(),
    );
  });
});

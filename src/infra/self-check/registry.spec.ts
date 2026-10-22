import { buildProbes } from './registry';
import type { PrismaService } from '../../prisma/prisma.service';

describe('buildProbes', () => {
  it('собирает все 19 проб с уникальными id', () => {
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
        'email',
        'encryptionReadable',
        'googleOAuth',
        'oauthRedirects',
        'paymentWebhooks',
        'robokassa',
        'runtimeMode',
        'telegram',
        'telegramPolling',
        'throttleStorage',
        'vkOAuth',
      ].sort(),
    );
    expect(new Set(ids).size).toBe(ids.length);
  });
});

import { buildProbes } from './registry';
import type { PrismaService } from '../../prisma/prisma.service';

describe('buildProbes', () => {
  it('собирает все 15 проб с уникальными id', () => {
    const probes = buildProbes({} as unknown as PrismaService);
    const ids = probes.map((p) => p.id);
    expect(ids.sort()).toEqual(
      [
        'alerts',
        'backupFreshness',
        'caldav',
        'ciRuns',
        'cronLeases',
        'db',
        'email',
        'googleOAuth',
        'oauthRedirects',
        'paymentWebhooks',
        'robokassa',
        'telegram',
        'telegramPolling',
        'throttleStorage',
        'vkOAuth',
      ].sort(),
    );
    expect(new Set(ids).size).toBe(ids.length);
  });
});

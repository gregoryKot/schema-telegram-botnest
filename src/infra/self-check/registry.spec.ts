import { buildProbes } from './registry';
import type { PrismaService } from '../../prisma/prisma.service';

describe('buildProbes', () => {
  it('собирает все 11 проб с уникальными id', () => {
    const probes = buildProbes({} as unknown as PrismaService);
    const ids = probes.map((p) => p.id);
    expect(ids.sort()).toEqual(
      [
        'alerts',
        'caldav',
        'ciRuns',
        'cronLeases',
        'db',
        'email',
        'googleOAuth',
        'oauthRedirects',
        'telegram',
        'throttleStorage',
        'vkOAuth',
      ].sort(),
    );
    expect(new Set(ids).size).toBe(ids.length);
  });
});

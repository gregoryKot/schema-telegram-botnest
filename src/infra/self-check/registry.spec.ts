import { buildProbes } from './registry';
import type { PrismaService } from '../../prisma/prisma.service';

describe('buildProbes', () => {
  it('собирает все 8 проб с уникальными id', () => {
    const probes = buildProbes({} as unknown as PrismaService);
    const ids = probes.map((p) => p.id);
    expect(ids.sort()).toEqual(
      [
        'alerts',
        'caldav',
        'cronLeases',
        'db',
        'email',
        'oauthRedirects',
        'telegram',
        'throttleStorage',
      ].sort(),
    );
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// Повтор отозванного refresh-токена (refresh-reuse.ts) — прямо, без AuthService.
//
// Сценарии целиком (настоящая ротация, securityLog) — в auth.service.spec.ts и
// refresh-theft.spec.ts. Здесь — развилки самого resolveReuse, которые
// мутационный замер (stryker.golden-auth.config.json) не отличал от поломки:
// бюджет восстановлений считается только у `recover`, семью отзывают только
// при краже и только если она есть, а «восстановить» отдаётся значением.
import { UnauthorizedException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { resolveReuse, type ReusedSession } from './refresh-reuse';
import { REFRESH_REUSE_GRACE_MS } from './refresh-rotation';
import { RECOVER_MAX_PER_WINDOW } from './refresh-recover-budget';

const NOW = new Date('2026-11-09T12:00:00.000Z');
const LATER = new Date(NOW.getTime() + 3600_000);

function makeDeps(opts: { successor?: unknown; recoveries?: number } = {}) {
  const webSession = {
    findUnique: jest.fn().mockResolvedValue(opts.successor ?? null),
    count: jest.fn().mockResolvedValue(opts.recoveries ?? 0),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
  };
  const deps = {
    prisma: { webSession } as unknown as PrismaService,
    onWarn: jest.fn(),
    onAlert: jest.fn(),
    onEcho: jest.fn(),
  };
  return { deps, webSession };
}

const session = (over: Partial<ReusedSession> = {}): ReusedSession => ({
  userId: 7n,
  family: 'fam-1',
  revokedAt: new Date(NOW.getTime() - 60_000),
  replacedByHash: 'next-hash',
  ...over,
});

describe('resolveReuse', () => {
  it('наследник жив и не тронут, бюджет не исчерпан — возвращает «recover», семью не трогает', async () => {
    const { deps, webSession } = makeDeps({
      successor: { revokedAt: null, expiresAt: LATER },
    });
    await expect(resolveReuse(deps, session(), NOW)).resolves.toBe('recover');
    expect(webSession.count).toHaveBeenCalledTimes(1);
    expect(webSession.updateMany).not.toHaveBeenCalled();
    expect(deps.onWarn).toHaveBeenCalledWith(
      expect.stringContaining('response was lost'),
    );
  });

  it('бюджет восстановлений исчерпан — кража: семья отозвана, 401', async () => {
    const { deps, webSession } = makeDeps({
      successor: { revokedAt: null, expiresAt: LATER },
      recoveries: RECOVER_MAX_PER_WINDOW,
    });
    await expect(resolveReuse(deps, session(), NOW)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(webSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ family: 'fam-1', revokedAt: null }),
      }),
    );
    expect(deps.onAlert).toHaveBeenCalledWith(7n, 'fam-1');
  });

  it('отказ (истёк по TTL, не отзывали) — бюджет не считается, семья не отзывается', async () => {
    const { deps, webSession } = makeDeps();
    await expect(
      resolveReuse(
        deps,
        session({ revokedAt: null, replacedByHash: null }),
        NOW,
      ),
    ).rejects.toThrow('Refresh token already used or expired');
    expect(webSession.findUnique).not.toHaveBeenCalled();
    expect(webSession.count).not.toHaveBeenCalled();
    expect(webSession.updateMany).not.toHaveBeenCalled();
    expect(deps.onWarn).toHaveBeenCalledWith(
      expect.stringContaining('expired naturally'),
    );
  });

  it('кража без семьи (строка до появления family) — 401 без отзыва', async () => {
    const { deps, webSession } = makeDeps();
    const old = new Date(NOW.getTime() - REFRESH_REUSE_GRACE_MS - 1);
    await expect(
      resolveReuse(
        deps,
        session({ family: '', revokedAt: old, replacedByHash: null }),
        NOW,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(webSession.count).not.toHaveBeenCalled();
    expect(webSession.updateMany).not.toHaveBeenCalled();
  });
});

// A2/A3 (аудит 2026-10): «кто за запросом» для деструктивных подтверждений.
// Сессию доказывает проверенный access-JWT (req.webUser) либо ЖИВАЯ
// refresh-кука; всё остальное — аноним.
import type { Request } from 'express';
import { CallerIdentityService } from './caller-identity';
import { REFRESH_COOKIE } from './auth-http.util';
import { hashToken } from './email.util';

type Row = { userId: bigint; revokedAt: Date | null; expiresAt: Date };

function make(rows: Record<string, Row> = {}) {
  const findUnique = jest.fn(({ where }: { where: { tokenHash: string } }) =>
    Promise.resolve(rows[where.tokenHash] ?? null),
  );
  const svc = new CallerIdentityService({
    webSession: { findUnique },
  } as never);
  return { svc, findUnique };
}

const req = (r: Partial<Record<'webUser' | 'cookies', unknown>>) =>
  r as unknown as Request;
const live = (userId: bigint): Row => ({
  userId,
  revokedAt: null,
  expiresAt: new Date(Date.now() + 60_000),
});

describe('CallerIdentityService.resolve', () => {
  it('Bearer (req.webUser) → его userId, БД не трогаем', async () => {
    const { svc, findUnique } = make();
    await expect(svc.resolve(req({ webUser: { userId: 5n } }))).resolves.toBe(
      5n,
    );
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('нет ни Bearer, ни куки → null', async () => {
    const { svc } = make();
    await expect(svc.resolve(req({ cookies: {} }))).resolves.toBeNull();
    await expect(svc.resolve(req({}))).resolves.toBeNull();
  });

  it('живая refresh-кука → userId владельца сессии; ищем по sha256, а не по сырому токену', async () => {
    const { svc, findUnique } = make({ [hashToken('raw')]: live(9n) });
    await expect(
      svc.resolve(req({ cookies: { [REFRESH_COOKIE]: 'raw' } })),
    ).resolves.toBe(9n);
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tokenHash: hashToken('raw') } }),
    );
  });

  it('кука с неизвестным токеном → null', async () => {
    const { svc } = make();
    await expect(
      svc.resolve(req({ cookies: { [REFRESH_COOKIE]: 'nope' } })),
    ).resolves.toBeNull();
  });

  it.each([
    ['отозванная', { ...live(9n), revokedAt: new Date() }],
    ['истёкшая', { ...live(9n), expiresAt: new Date(Date.now() - 1) }],
  ])(
    '%s сессия → null (украденная старая кука не доказательство)',
    async (_n, row) => {
      const { svc } = make({ [hashToken('raw')]: row });
      await expect(
        svc.resolve(req({ cookies: { [REFRESH_COOKIE]: 'raw' } })),
      ).resolves.toBeNull();
    },
  );

  it('Bearer приоритетнее куки', async () => {
    const { svc } = make({ [hashToken('raw')]: live(9n) });
    await expect(
      svc.resolve(
        req({
          webUser: { userId: 5n },
          cookies: { [REFRESH_COOKIE]: 'raw' },
        }),
      ),
    ).resolves.toBe(5n);
  });
});

// Хвост S12 (аудит 2026-11): отзыв сессии гасит её access-токен сразу.
import { UnauthorizedException } from '@nestjs/common';
import { assertLiveAccess } from './live-access';

function makePrisma(
  account: { deletedAt: Date | null } | null = { deletedAt: null },
  session: { id: string } | null = { id: 's1' },
) {
  return {
    user: { findUnique: jest.fn().mockResolvedValue(account) },
    webSession: { findFirst: jest.fn().mockResolvedValue(session) },
  };
}

describe('assertLiveAccess', () => {
  it('sid живой цепочки этого аккаунта → пропуск; ищется только неотозванная строка', async () => {
    const prisma = makePrisma();
    await expect(
      assertLiveAccess(prisma as never, 7n, 'fam'),
    ).resolves.toBeUndefined();
    expect(prisma.webSession.findFirst).toHaveBeenCalledWith({
      where: { family: 'fam', userId: 7n, revokedAt: null },
      select: { id: true },
    });
  });

  it('цепочка отозвана (живой строки нет) → 401 сразу', async () => {
    const prisma = makePrisma({ deletedAt: null }, null);
    await expect(assertLiveAccess(prisma as never, 7n, 'fam')).rejects.toThrow(
      new UnauthorizedException('Session revoked'),
    );
  });

  it('токен без sid (старый формат) → только сверка аккаунта, сессии не читаем', async () => {
    const prisma = makePrisma({ deletedAt: null }, null);
    await expect(
      assertLiveAccess(prisma as never, 7n, undefined),
    ).resolves.toBeUndefined();
    expect(prisma.webSession.findFirst).not.toHaveBeenCalled();
  });

  it.each([
    ['строки нет', null],
    ['deletedAt', { deletedAt: new Date() }],
  ])('аккаунт: %s → 401 даже при живой сессии', async (_label, account) => {
    const prisma = makePrisma(account);
    await expect(assertLiveAccess(prisma as never, 7n, 'fam')).rejects.toThrow(
      new UnauthorizedException('Account gone'),
    );
  });
});

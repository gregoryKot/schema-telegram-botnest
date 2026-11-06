// «Владелец практики» (practice-owner.ts): единственный разбор ADMIN_ID и
// аккаунт владельца с учётом слияния (запись клиента из приложения, #546).
import { practiceOwnerTelegramId, practiceOwnerUserId } from './practice-owner';
import type { AuthProviderReader } from '../auth/telegram-identity';

const ORIGINAL = process.env.ADMIN_ID;
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.ADMIN_ID;
  else process.env.ADMIN_ID = ORIGINAL;
});

function readerWith(linked: bigint | null) {
  const findUnique = jest
    .fn()
    .mockResolvedValue(linked === null ? null : { userId: linked });
  const prisma: AuthProviderReader = {
    authProvider: { findUnique, findFirst: jest.fn(), findMany: jest.fn() },
  };
  return { prisma, findUnique };
}

describe('practiceOwnerTelegramId', () => {
  it('ADMIN_ID не задан, мусор, ноль, отрицательный → null', () => {
    for (const v of [undefined, '', 'abc', '0', '-5']) {
      if (v === undefined) delete process.env.ADMIN_ID;
      else process.env.ADMIN_ID = v;
      expect(practiceOwnerTelegramId()).toBeNull();
    }
  });

  it('положительное число → оно же', () => {
    process.env.ADMIN_ID = '424242';
    expect(practiceOwnerTelegramId()).toBe(424242);
  });
});

describe('practiceOwnerUserId', () => {
  it('ADMIN_ID не задан → null, в БД не ходим', async () => {
    delete process.env.ADMIN_ID;
    const { prisma, findUnique } = readerWith(null);
    await expect(practiceOwnerUserId(prisma)).resolves.toBeNull();
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('телеграм-аккаунт без привязки → userId равен ADMIN_ID', async () => {
    process.env.ADMIN_ID = '424242';
    const { prisma } = readerWith(null);
    await expect(practiceOwnerUserId(prisma)).resolves.toBe(424242n);
  });

  it('аккаунт слит с веб-входом → userId из AuthProvider, а не ADMIN_ID', async () => {
    process.env.ADMIN_ID = '424242';
    const merged = 1_000_000_000_000_777n;
    const { prisma, findUnique } = readerWith(merged);
    await expect(practiceOwnerUserId(prisma)).resolves.toBe(merged);
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          provider_providerId: { provider: 'telegram', providerId: '424242' },
        },
      }),
    );
  });
});

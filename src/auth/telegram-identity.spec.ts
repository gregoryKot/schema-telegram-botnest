// Соответствие «аккаунт ↔ адрес в Telegram». Разбор 2026-08-29: планировщик
// подставлял userId в sendMessage как чат-адрес, а бот при /start заводил
// строку User с id = telegramId — оба места ломались ровно на слитых
// аккаунтах, где эти два числа разные.
import {
  canonicalUserId,
  telegramIdFor,
  telegramIdsFor,
} from './telegram-identity';

function makePrisma(rows: Array<{ userId: bigint; providerId: string }> = []) {
  return {
    authProvider: {
      findUnique: jest.fn(async (args: any) => {
        const wanted = args.where.provider_providerId.providerId;
        const row = rows.find((r) => r.providerId === wanted);
        return row ? { userId: row.userId } : null;
      }),
      findFirst: jest.fn(async (args: any) => {
        const found = rows.filter((r) => r.userId === args.where.userId);
        const last = found[found.length - 1];
        return last ? { providerId: last.providerId } : null;
      }),
      findMany: jest.fn(async (args: any) => {
        const ids: bigint[] = args.where.userId.in;
        return rows.filter((r) => ids.some((id) => id === r.userId));
      }),
    },
  };
}

describe('canonicalUserId', () => {
  it('привязка есть → отдаёт владельца, а НЕ сырой telegramId', async () => {
    // Аккаунт слит: данные человека лежат под веб-номером. Запись по сырому
    // номеру завела бы рядом второй, пустой аккаунт.
    const prisma = makePrisma([
      { userId: 1_000_000_000_000_777n, providerId: '42' },
    ]);
    await expect(canonicalUserId(prisma, 42)).resolves.toBe(
      1_000_000_000_000_777n,
    );
  });

  it('привязки нет → сам telegramId (старый пользователь бота и новичок)', async () => {
    const prisma = makePrisma();
    await expect(canonicalUserId(prisma, 42)).resolves.toBe(42n);
  });

  it('спрашивает ровно по паре (provider, providerId)', async () => {
    const prisma = makePrisma();
    await canonicalUserId(prisma, 42n);
    expect(prisma.authProvider.findUnique).toHaveBeenCalledWith({
      where: {
        provider_providerId: { provider: 'telegram', providerId: '42' },
      },
      select: { userId: true },
    });
  });
});

describe('telegramIdFor', () => {
  it('привязка есть → её providerId числом', async () => {
    const prisma = makePrisma([{ userId: 7n, providerId: '42' }]);
    await expect(telegramIdFor(prisma, 7n)).resolves.toBe(42n);
  });

  it('привязки нет → null: писать этому аккаунту некуда', async () => {
    const prisma = makePrisma();
    await expect(telegramIdFor(prisma, 7n)).resolves.toBeNull();
  });

  it('битый providerId не роняет вызов, а даёт null', async () => {
    const prisma = makePrisma([{ userId: 7n, providerId: 'не-число' }]);
    await expect(telegramIdFor(prisma, 7n)).resolves.toBeNull();
  });
});

describe('telegramIdsFor', () => {
  it('пустой список → пустая карта БЕЗ похода в БД', async () => {
    const prisma = makePrisma();
    const map = await telegramIdsFor(prisma, []);
    expect(map.size).toBe(0);
    expect(prisma.authProvider.findMany).not.toHaveBeenCalled();
  });

  it('пачка аккаунтов — ОДИН запрос, не N+1', async () => {
    const prisma = makePrisma([
      { userId: 1n, providerId: '11' },
      { userId: 2n, providerId: '22' },
      { userId: 3n, providerId: '33' },
    ]);
    const map = await telegramIdsFor(prisma, [1n, 2n, 3n]);
    expect(prisma.authProvider.findMany).toHaveBeenCalledTimes(1);
    expect(map.get('1')).toBe(11n);
    expect(map.get('2')).toBe(22n);
    expect(map.get('3')).toBe(33n);
  });

  it('повторы в списке схлопываются до одного значения в запросе', async () => {
    const prisma = makePrisma([{ userId: 1n, providerId: '11' }]);
    await telegramIdsFor(prisma, [1n, 1n, 1n]);
    expect(prisma.authProvider.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { provider: 'telegram', userId: { in: [1n] } },
      }),
    );
  });

  it('аккаунт без привязки в карте отсутствует — это и есть «некуда слать»', async () => {
    const prisma = makePrisma([{ userId: 1n, providerId: '11' }]);
    const map = await telegramIdsFor(prisma, [1n, 1_000_000_000_000_002n]);
    expect(map.has('1000000000000002')).toBe(false);
  });

  it('две привязки у одного аккаунта → выигрывает последняя, детерминированно', async () => {
    const prisma = makePrisma([
      { userId: 1n, providerId: '11' },
      { userId: 1n, providerId: '99' },
    ]);
    const map = await telegramIdsFor(prisma, [1n]);
    expect(map.get('1')).toBe(99n);
  });

  it('битый providerId пропускается, соседи в карту попадают', async () => {
    const prisma = makePrisma([
      { userId: 1n, providerId: 'мусор' },
      { userId: 2n, providerId: '22' },
    ]);
    const map = await telegramIdsFor(prisma, [1n, 2n]);
    expect(map.has('1')).toBe(false);
    expect(map.get('2')).toBe(22n);
  });
});

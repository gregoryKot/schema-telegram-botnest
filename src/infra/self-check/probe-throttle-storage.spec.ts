import { throttleStorageProbe } from './probe-throttle-storage';
import type { PrismaService } from '../../prisma/prisma.service';

function fakePrisma(queryRaw: jest.Mock): PrismaService {
  return { $queryRaw: queryRaw } as unknown as PrismaService;
}

describe('throttleStorageProbe', () => {
  it('запись/чтение в ThrottleHit проходят — ok', async () => {
    const queryRaw = jest.fn().mockResolvedValue([
      {
        hits: 1,
        expiresAt: new Date(Date.now() + 5_000),
        blockedUntil: null,
      },
    ]);
    const res = await throttleStorageProbe(fakePrisma(queryRaw)).run();
    expect(res).toEqual({ ok: true, detail: 'запись и чтение прошли' });
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it('Postgres недоступен — не ok, деталь из ошибки', async () => {
    const queryRaw = jest
      .fn()
      .mockRejectedValue(new Error('connection refused'));
    const res = await throttleStorageProbe(fakePrisma(queryRaw)).run();
    expect(res.ok).toBe(false);
    expect(res.detail).toContain('connection refused');
  });

  it('строка вернулась, но счётчик не поднялся — не ok (защита от тихой порчи)', async () => {
    const queryRaw = jest.fn().mockResolvedValue([
      {
        hits: 0,
        expiresAt: new Date(Date.now() + 5_000),
        blockedUntil: null,
      },
    ]);
    const res = await throttleStorageProbe(fakePrisma(queryRaw)).run();
    expect(res.ok).toBe(false);
  });
});

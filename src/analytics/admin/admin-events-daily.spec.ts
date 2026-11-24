// Сам SQL проверяет живой спек test/raw-sql-live-admin-analytics.e2e-spec.ts.
import { eventsPerDay } from './admin-events-daily';
import type { PrismaService } from '../../prisma/prisma.service';

function fakePrisma(rows: Array<{ day: string; n: bigint }>) {
  const $queryRaw = jest.fn().mockResolvedValue(rows);
  return { prisma: { $queryRaw } as unknown as PrismaService, $queryRaw };
}

describe('eventsPerDay', () => {
  const since = new Date('2026-10-01T00:00:00Z');

  it('bigint превращается в число, ключ — день', async () => {
    const { prisma } = fakePrisma([{ day: '2026-11-01', n: 5n }]);
    const res = await eventsPerDay(prisma, since);
    expect(res).toEqual(new Map([['2026-11-01', 5]]));
  });

  it('пустой ответ — пустая Map', async () => {
    const { prisma } = fakePrisma([]);
    expect((await eventsPerDay(prisma, since)).size).toBe(0);
  });

  it('since уходит в запрос параметром', async () => {
    const { prisma, $queryRaw } = fakePrisma([]);
    await eventsPerDay(prisma, since);
    expect($queryRaw.mock.calls[0].slice(1)).toContain(since);
  });
});

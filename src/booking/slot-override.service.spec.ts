// SlotOverrideService.apply — порядок операций в транзакции (clear ДО set)
// и точные аргументы upsert/deleteMany критичны: перепутанный порядок даёт
// «поставил и тут же снял», а голый upsert без where:{startsAt} задвоил бы
// строку вместо обновления (startsAt @unique).
import { SlotOverrideKind } from '@prisma/client';
import { SlotOverrideService } from './slot-override.service';

function makeService() {
  const tx = {
    slotOverride: {
      deleteMany: jest.fn(async () => ({ count: 0 })),
      upsert: jest.fn(async () => ({})),
    },
  };
  const prisma: any = {
    slotOverride: { findMany: jest.fn(async () => []) },
    $transaction: jest.fn(async (fn: any) => fn(tx)),
  };
  return { service: new SlotOverrideService(prisma), prisma, tx };
}

describe('SlotOverrideService.listBetween', () => {
  it('запрашивает окно [from, toExclusive) по startsAt', async () => {
    const { service, prisma } = makeService();
    const from = new Date('2026-07-13T00:00:00Z');
    const to = new Date('2026-07-20T00:00:00Z');
    await service.listBetween(from, to);
    expect(prisma.slotOverride.findMany).toHaveBeenCalledWith({
      where: { startsAt: { gte: from, lt: to } },
    });
  });
});

describe('SlotOverrideService.apply', () => {
  it('deleteMany уходит с точным where:{startsAt:{in:clear}}', async () => {
    const { service, tx } = makeService();
    const clear = [
      new Date('2026-07-13T09:00:00Z'),
      new Date('2026-07-13T10:00:00Z'),
    ];
    await service.apply({ set: [], clear });
    expect(tx.slotOverride.deleteMany).toHaveBeenCalledWith({
      where: { startsAt: { in: clear } },
    });
  });

  it('upsert на каждый set уходит с where:{startsAt}, create и update — точные аргументы', async () => {
    const { service, tx } = makeService();
    const startsAt = new Date('2026-07-13T09:00:00Z');
    await service.apply({
      set: [{ startsAt, durationMin: 50, kind: SlotOverrideKind.BLOCK }],
      clear: [],
    });
    expect(tx.slotOverride.upsert).toHaveBeenCalledWith({
      where: { startsAt },
      create: { startsAt, durationMin: 50, kind: SlotOverrideKind.BLOCK },
      update: { kind: SlotOverrideKind.BLOCK, durationMin: 50 },
    });
  });

  it('несколько set — upsert вызывается по разу на каждый, в порядке входного массива', async () => {
    const { service, tx } = makeService();
    const a = new Date('2026-07-13T09:00:00Z');
    const b = new Date('2026-07-13T10:00:00Z');
    await service.apply({
      set: [
        { startsAt: a, durationMin: 50, kind: SlotOverrideKind.BLOCK },
        { startsAt: b, durationMin: 45, kind: SlotOverrideKind.OPEN },
      ],
      clear: [],
    });
    expect(tx.slotOverride.upsert).toHaveBeenCalledTimes(2);
    expect(tx.slotOverride.upsert.mock.calls[0][0]).toEqual({
      where: { startsAt: a },
      create: { startsAt: a, durationMin: 50, kind: SlotOverrideKind.BLOCK },
      update: { kind: SlotOverrideKind.BLOCK, durationMin: 50 },
    });
    expect(tx.slotOverride.upsert.mock.calls[1][0]).toEqual({
      where: { startsAt: b },
      create: { startsAt: b, durationMin: 45, kind: SlotOverrideKind.OPEN },
      update: { kind: SlotOverrideKind.OPEN, durationMin: 45 },
    });
  });

  it('порядок: deleteMany отрабатывает ДО первого upsert (иначе новый set потерялся бы под своим же clear)', async () => {
    const { service, tx } = makeService();
    await service.apply({
      set: [
        {
          startsAt: new Date('2026-07-13T09:00:00Z'),
          durationMin: 50,
          kind: SlotOverrideKind.OPEN,
        },
      ],
      clear: [new Date('2026-07-13T10:00:00Z')],
    });
    const deleteOrder = tx.slotOverride.deleteMany.mock.invocationCallOrder[0];
    const upsertOrder = tx.slotOverride.upsert.mock.invocationCallOrder[0];
    expect(deleteOrder).toBeLessThan(upsertOrder);
  });

  it('всё происходит внутри $transaction (не напрямую на prisma) — ровно один вызов с колбэком', async () => {
    const { service, prisma } = makeService();
    await service.apply({ set: [], clear: [new Date('2026-07-13T09:00:00Z')] });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(typeof prisma.$transaction.mock.calls[0][0]).toBe('function');
  });

  it('возвращает { ok: true }', async () => {
    const { service } = makeService();
    await expect(
      service.apply({ set: [], clear: [new Date('2026-07-13T09:00:00Z')] }),
    ).resolves.toEqual({ ok: true });
  });
});

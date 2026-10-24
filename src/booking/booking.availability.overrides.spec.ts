// Ручной слой SlotOverride над assertWithinAvailability — контракт
// «Календарь слотов в админке», пункт 2. booking.availability.spec.ts /
// booking.availability.boundary.spec.ts покрывают чистые правила без
// overrides; здесь — BLOCK/OPEN поверх них.
import { assertWithinAvailability } from './booking.availability';

const RULE = {
  id: 1,
  dayOfWeek: 1, // Mon
  startHour: 10,
  startMinute: 0,
  endHour: 19,
  endMinute: 0,
  timezone: 'Europe/Moscow',
  isActive: true,
};
const SLOT = new Date('2026-07-13T09:00:00Z'); // пн 12:00 МСК — внутри окна RULE
const OUTSIDE = new Date('2026-07-13T20:00:00Z'); // пн 23:00 МСК — вне окна RULE

function makeService(opts: { rules?: any[]; overrides?: any[] }) {
  const prisma: any = {
    availabilityRule: { findMany: jest.fn(async () => opts.rules ?? []) },
    slotOverride: { findMany: jest.fn(async () => opts.overrides ?? []) },
  };
  const assert = (startsAt: Date, durationMin: number) =>
    assertWithinAvailability(prisma, startsAt, durationMin);
  return { assert, prisma };
}

describe('assertWithinAvailability — BLOCK', () => {
  it('BLOCK, пересекающий слот, отклоняет SLOT_BLOCKED ДАЖЕ если правило разрешает', async () => {
    const overrides = [{ kind: 'BLOCK', startsAt: SLOT, durationMin: 50 }];
    const { assert } = makeService({ rules: [RULE], overrides });
    await expect(assert(SLOT, 50)).rejects.toThrow('SLOT_BLOCKED');
  });

  it('BLOCK отклоняет и когда правил нет вообще (проверяется ДО раннего выхода)', async () => {
    const overrides = [{ kind: 'BLOCK', startsAt: SLOT, durationMin: 50 }];
    const { assert } = makeService({ rules: [], overrides });
    await expect(assert(SLOT, 50)).rejects.toThrow('SLOT_BLOCKED');
  });

  it('BLOCK с пересечением (не точное совпадение startsAt) тоже отклоняет', async () => {
    const overrides = [
      {
        kind: 'BLOCK',
        startsAt: new Date(SLOT.getTime() + 20 * 60_000),
        durationMin: 50,
      },
    ];
    const { assert } = makeService({ rules: [RULE], overrides });
    await expect(assert(SLOT, 50)).rejects.toThrow('SLOT_BLOCKED');
  });

  it('контроль: BLOCK в другое время не мешает', async () => {
    const overrides = [
      {
        kind: 'BLOCK',
        startsAt: new Date(SLOT.getTime() + 6 * 3_600_000),
        durationMin: 50,
      },
    ];
    const { assert } = makeService({ rules: [RULE], overrides });
    await expect(assert(SLOT, 50)).resolves.toBeUndefined();
  });
});

describe('assertWithinAvailability — OPEN', () => {
  it('OPEN с тем же startsAt и достаточной durationMin разрешает слот вне покрытия правил', async () => {
    const overrides = [{ kind: 'OPEN', startsAt: OUTSIDE, durationMin: 50 }];
    const { assert } = makeService({ rules: [RULE], overrides });
    await expect(assert(OUTSIDE, 50)).resolves.toBeUndefined();
  });

  it('durationMin ровно равна override.durationMin — разрешает (граница включительно)', async () => {
    const overrides = [{ kind: 'OPEN', startsAt: OUTSIDE, durationMin: 50 }];
    const { assert } = makeService({ rules: [RULE], overrides });
    await expect(assert(OUTSIDE, 50)).resolves.toBeUndefined();
  });

  it('контроль: OPEN с меньшей длительностью не разрешает более длинный слот', async () => {
    const overrides = [{ kind: 'OPEN', startsAt: OUTSIDE, durationMin: 30 }];
    const { assert } = makeService({ rules: [RULE], overrides });
    await expect(assert(OUTSIDE, 50)).rejects.toThrow('OUTSIDE_AVAILABILITY');
  });

  it('контроль: OPEN на другой startsAt (не точное совпадение) не разрешает', async () => {
    const overrides = [
      {
        kind: 'OPEN',
        startsAt: new Date(OUTSIDE.getTime() + 10 * 60_000),
        durationMin: 50,
      },
    ];
    const { assert } = makeService({ rules: [RULE], overrides });
    await expect(assert(OUTSIDE, 50)).rejects.toThrow('OUTSIDE_AVAILABILITY');
  });

  it('без OPEN слот вне покрытия правил как раньше — OUTSIDE_AVAILABILITY', async () => {
    const { assert } = makeService({ rules: [RULE], overrides: [] });
    await expect(assert(OUTSIDE, 50)).rejects.toThrow('OUTSIDE_AVAILABILITY');
  });
});

describe('assertWithinAvailability — окно скана overrides', () => {
  it('slotOverride.findMany запрашивается по where:{startsAt:{gte,lt}} вокруг слота', async () => {
    const { assert, prisma } = makeService({ rules: [RULE] });
    await assert(SLOT, 50);
    const call = prisma.slotOverride.findMany.mock.calls[0][0];
    const endsAt = new Date(SLOT.getTime() + 50 * 60_000);
    // Запас скана назад — 180 мин (максимальная длительность override'а),
    // чтобы поймать BLOCK, начавшийся раньше SLOT, но пересекающий его.
    expect(call.where.startsAt.gte).toEqual(
      new Date(SLOT.getTime() - 180 * 60_000),
    );
    expect(call.where.startsAt.lt).toEqual(endsAt);
  });
});

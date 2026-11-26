// overlapsBusy/isOccupied перенесены из slot.service.ts без изменения
// поведения — slot.service.spec.ts уже проверял их косвенно через весь
// сервис, здесь регрессия на сам перенос + прямые тесты новой applyOverrides.
import {
  overlapsBusy,
  isOccupied,
  overlapsInterval,
  applyOverrides,
  SlotLike,
  OverrideLike,
} from './slot-filters';

describe('overlapsInterval / overlapsBusy', () => {
  it('пересекающиеся интервалы — true', () => {
    const busy = [
      {
        start: new Date('2026-01-01T10:20:00Z'),
        end: new Date('2026-01-01T10:40:00Z'),
      },
    ];
    expect(
      overlapsBusy(
        new Date('2026-01-01T10:00:00Z'),
        new Date('2026-01-01T10:50:00Z'),
        busy,
      ),
    ).toBe(true);
  });

  it('вплотную примыкающие интервалы (end === start) — НЕ пересечение', () => {
    const busy = [
      {
        start: new Date('2026-01-01T11:00:00Z'),
        end: new Date('2026-01-01T11:30:00Z'),
      },
    ];
    expect(
      overlapsInterval(
        new Date('2026-01-01T10:10:00Z'),
        new Date('2026-01-01T11:00:00Z'),
        busy,
      ),
    ).toBe(false);
  });

  it('интервал в другое время — false', () => {
    const busy = [
      {
        start: new Date('2026-01-02T10:00:00Z'),
        end: new Date('2026-01-02T10:30:00Z'),
      },
    ];
    expect(
      overlapsBusy(
        new Date('2026-01-01T10:00:00Z'),
        new Date('2026-01-01T10:50:00Z'),
        busy,
      ),
    ).toBe(false);
  });
});

describe('isOccupied', () => {
  it('частичное пересечение брони блокирует', () => {
    const bookings = [
      { startsAt: new Date('2026-01-01T10:30:00Z'), durationMin: 50 },
    ];
    expect(
      isOccupied(
        new Date('2026-01-01T10:00:00Z'),
        new Date('2026-01-01T10:50:00Z'),
        bookings,
      ),
    ).toBe(true);
  });

  it('бронь без пересечения — не блокирует', () => {
    const bookings = [
      { startsAt: new Date('2026-01-01T12:00:00Z'), durationMin: 50 },
    ];
    expect(
      isOccupied(
        new Date('2026-01-01T10:00:00Z'),
        new Date('2026-01-01T10:50:00Z'),
        bookings,
      ),
    ).toBe(false);
  });
});

describe('applyOverrides', () => {
  const RULE_SLOT: SlotLike = {
    startsAt: new Date('2026-07-13T09:00:00Z'),
    endsAt: new Date('2026-07-13T09:50:00Z'),
    durationMin: 50,
  };
  const EARLIEST = new Date('2026-07-01T00:00:00Z').getTime();
  const baseCtx = { earliest: EARLIEST, bookings: [], busy: [] };

  it('BLOCK, пересекающий слот, убирает его', () => {
    const overrides: OverrideLike[] = [
      {
        kind: 'BLOCK',
        startsAt: new Date('2026-07-13T09:00:00Z'),
        durationMin: 50,
      },
    ];
    const result = applyOverrides([RULE_SLOT], overrides, baseCtx);
    expect(result).toEqual([]);
  });

  it('BLOCK с частичным пересечением (не точное совпадение startsAt) тоже убирает', () => {
    const overrides: OverrideLike[] = [
      {
        kind: 'BLOCK',
        startsAt: new Date('2026-07-13T09:30:00Z'),
        durationMin: 50,
      },
    ];
    const result = applyOverrides([RULE_SLOT], overrides, baseCtx);
    expect(result).toEqual([]);
  });

  it('контроль: BLOCK в другое время ничего не убирает', () => {
    const overrides: OverrideLike[] = [
      {
        kind: 'BLOCK',
        startsAt: new Date('2026-07-13T15:00:00Z'),
        durationMin: 50,
      },
    ];
    const result = applyOverrides([RULE_SLOT], overrides, baseCtx);
    expect(result).toEqual([RULE_SLOT]);
  });

  it('OPEN вне правил добавляет новый слот', () => {
    const overrides: OverrideLike[] = [
      {
        kind: 'OPEN',
        startsAt: new Date('2026-07-13T20:00:00Z'),
        durationMin: 45,
      },
    ];
    const result = applyOverrides([RULE_SLOT], overrides, baseCtx);
    expect(result).toEqual([
      RULE_SLOT,
      {
        startsAt: new Date('2026-07-13T20:00:00Z'),
        endsAt: new Date('2026-07-13T20:45:00Z'),
        durationMin: 45,
      },
    ]);
  });

  it('OPEN работает и при нуле правил (пустой входной список слотов)', () => {
    const overrides: OverrideLike[] = [
      {
        kind: 'OPEN',
        startsAt: new Date('2026-07-13T20:00:00Z'),
        durationMin: 45,
      },
    ];
    const result = applyOverrides([], overrides, baseCtx);
    expect(result).toHaveLength(1);
    expect(result[0].startsAt.toISOString()).toBe('2026-07-13T20:00:00.000Z');
  });

  it('OPEN, совпадающий по startsAt с уже существующим слотом, не дублируется', () => {
    const overrides: OverrideLike[] = [
      {
        kind: 'OPEN',
        startsAt: new Date('2026-07-13T09:00:00Z'),
        durationMin: 50,
      },
    ];
    const result = applyOverrides([RULE_SLOT], overrides, baseCtx);
    expect(result).toEqual([RULE_SLOT]);
  });

  it('OPEN, совпадающий с бронью, не добавляется', () => {
    const overrides: OverrideLike[] = [
      {
        kind: 'OPEN',
        startsAt: new Date('2026-07-13T20:00:00Z'),
        durationMin: 45,
      },
    ];
    const ctx = {
      ...baseCtx,
      bookings: [
        { startsAt: new Date('2026-07-13T20:10:00Z'), durationMin: 30 },
      ],
    };
    const result = applyOverrides([RULE_SLOT], overrides, ctx);
    expect(result).toEqual([RULE_SLOT]);
  });

  it('OPEN, совпадающий с занятостью календаря, не добавляется', () => {
    const overrides: OverrideLike[] = [
      {
        kind: 'OPEN',
        startsAt: new Date('2026-07-13T20:00:00Z'),
        durationMin: 45,
      },
    ];
    const ctx = {
      ...baseCtx,
      busy: [
        {
          start: new Date('2026-07-13T20:20:00Z'),
          end: new Date('2026-07-13T20:40:00Z'),
        },
      ],
    };
    const result = applyOverrides([RULE_SLOT], overrides, ctx);
    expect(result).toEqual([RULE_SLOT]);
  });

  it('OPEN, пересекающий BLOCK на другом startsAt, не добавляется', () => {
    const overrides: OverrideLike[] = [
      {
        kind: 'BLOCK',
        startsAt: new Date('2026-07-13T20:20:00Z'),
        durationMin: 30,
      },
      {
        kind: 'OPEN',
        startsAt: new Date('2026-07-13T20:00:00Z'),
        durationMin: 45,
      },
    ];
    const result = applyOverrides([RULE_SLOT], overrides, baseCtx);
    expect(result).toEqual([RULE_SLOT]);
  });

  it('OPEN раньше earliest не добавляется', () => {
    const overrides: OverrideLike[] = [
      {
        kind: 'OPEN',
        startsAt: new Date('2026-06-01T09:00:00Z'),
        durationMin: 45,
      },
    ];
    const result = applyOverrides([RULE_SLOT], overrides, baseCtx);
    expect(result).toEqual([RULE_SLOT]);
  });

  it('итог отсортирован по startsAt', () => {
    const early: SlotLike = {
      startsAt: new Date('2026-07-13T08:00:00Z'),
      endsAt: new Date('2026-07-13T08:50:00Z'),
      durationMin: 50,
    };
    const overrides: OverrideLike[] = [
      {
        kind: 'OPEN',
        startsAt: new Date('2026-07-13T07:00:00Z'),
        durationMin: 45,
      },
    ];
    const result = applyOverrides([RULE_SLOT, early], overrides, baseCtx);
    expect(result.map((s) => s.startsAt.toISOString())).toEqual([
      '2026-07-13T07:00:00.000Z',
      '2026-07-13T08:00:00.000Z',
      '2026-07-13T09:00:00.000Z',
    ]);
  });
});

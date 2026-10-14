import {
  computeSlotWindow,
  MAX_BOOKING_MIN,
  MAX_SLOT_SCAN_DAYS,
} from './slot-window';

describe('computeSlotWindow — одно окно для слотов, броней и календаря', () => {
  it('режет до целых UTC-суток: от 00:00Z fromDate до 23:59:59.999Z toDate', () => {
    const w = computeSlotWindow(
      new Date('2026-07-13T10:40:00Z'),
      new Date('2026-07-27T10:40:00Z'),
    );
    expect(w.rangeStart.toISOString()).toBe('2026-07-13T00:00:00.000Z');
    expect(w.rangeEnd.toISOString()).toBe('2026-07-27T23:59:59.999Z');
  });

  it('toDate в 00:00Z (явный ?to=YYYY-MM-DD) тоже тянется до конца суток', () => {
    const w = computeSlotWindow(new Date('2026-07-13'), new Date('2026-07-27'));
    expect(w.rangeEnd.toISOString()).toBe('2026-07-27T23:59:59.999Z');
  });

  it('выборка броней начинается раньше окна на самую долгую сессию', () => {
    const w = computeSlotWindow(new Date('2026-07-13'), new Date('2026-07-13'));
    expect(w.rangeStart.getTime() - w.bookingScanFrom.getTime()).toBe(
      MAX_BOOKING_MIN * 60_000,
    );
  });

  it('потолок перебора: окно не длиннее MAX_SLOT_SCAN_DAYS суток', () => {
    const w = computeSlotWindow(new Date('2026-01-01'), new Date('2090-01-01'));
    expect(w.rangeEnd.getTime() - w.rangeStart.getTime()).toBe(
      MAX_SLOT_SCAN_DAYS * 86_400_000,
    );
  });

  it('не мутирует аргументы', () => {
    const from = new Date('2026-07-13T10:40:00Z');
    const to = new Date('2026-07-27T10:40:00Z');
    computeSlotWindow(from, to);
    expect(from.toISOString()).toBe('2026-07-13T10:40:00.000Z');
    expect(to.toISOString()).toBe('2026-07-27T10:40:00.000Z');
  });
});

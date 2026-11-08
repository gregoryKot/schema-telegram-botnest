// Аудит 2026-11, S17: диапазон публичного GET /api/booking/slots. Ручка
// пускает только окна внутри окна занятости календаря (slotsBusyWindow), иначе
// перебор дат снова превратил бы её в усилитель запросов к iCloud.
// Правило №25: календарный день — полночь UTC, «сегодня» клиента западнее UTC —
// вчерашний день UTC.
import { BadRequestException } from '@nestjs/common';
import {
  resolveSlotRange,
  slotsBusyWindow,
  SLOTS_HORIZON_DAYS,
} from './slot-range';

const DAY = 86_400_000;
// 03:00Z 8 ноября: в Нью-Йорке ещё 7 ноября (местное «сегодня» — вчера по UTC).
const NOW = Date.parse('2026-11-08T03:00:00Z');
const iso = (d: Date) => d.toISOString().slice(0, 10);
const reject = (from?: string, to?: string) =>
  expect(() => resolveSlotRange(from, to, NOW)).toThrow(BadRequestException);

describe('resolveSlotRange', () => {
  it('без параметров: с «сейчас» на 14 дней вперёд', () => {
    const r = resolveSlotRange(undefined, undefined, NOW);
    expect(r.from.getTime()).toBe(NOW);
    expect(r.to.getTime()).toBe(NOW + 14 * DAY);
  });

  it('явные дни — полночь UTC', () => {
    const r = resolveSlotRange('2026-11-10', '2026-11-12', NOW);
    expect(r.from.toISOString()).toBe('2026-11-10T00:00:00.000Z');
    expect(r.to.toISOString()).toBe('2026-11-12T00:00:00.000Z');
  });

  it('from = вчерашний день UTC — «сегодня» клиента западнее UTC, не прошлое', () => {
    expect(resolveSlotRange('2026-11-07', '2026-11-09', NOW).from).toEqual(
      new Date('2026-11-07T00:00:00Z'),
    );
  });

  it('from позавчера и раньше — 400', () => {
    reject('2026-11-06', '2026-11-09');
    reject('2000-01-01', '9999-12-31');
  });

  it('to раньше from — 400; тот же день — можно', () => {
    reject('2026-11-12', '2026-11-10');
    expect(() =>
      resolveSlotRange('2026-11-10', '2026-11-10', NOW),
    ).not.toThrow();
  });

  it('to без from: сегодняшний день не «раньше начала» (from — момент «сейчас»)', () => {
    expect(() => resolveSlotRange(undefined, '2026-11-08', NOW)).not.toThrow();
  });

  it('последний день горизонта — можно, следующий — 400', () => {
    const last = iso(
      new Date(Date.parse('2026-11-08T00:00:00Z') + SLOTS_HORIZON_DAYS * DAY),
    );
    const next = iso(new Date(Date.parse(`${last}T00:00:00Z`) + DAY));
    expect(() => resolveSlotRange('2026-11-10', last, NOW)).not.toThrow();
    reject('2026-11-10', next);
    reject(next, undefined);
  });

  it('to по умолчанию не выходит за горизонт', () => {
    const near = iso(new Date(Date.parse('2026-11-08T00:00:00Z') + 85 * DAY));
    const r = resolveSlotRange(near, undefined, NOW);
    expect(r.to.getTime()).toBe(slotsBusyWindow(NOW).to.getTime() - 1);
  });

  it('мусор и массив вместо даты — 400 (L11)', () => {
    reject('not-a-date', '2026-11-10');
    reject('2026-11-10', '2026-13-45');
    reject(['2026-11-10', '2026-11-11'] as unknown as string, undefined);
  });

  it('любой пропущенный диапазон лежит внутри окна занятости', () => {
    const win = slotsBusyWindow(NOW);
    for (const [f, t] of [
      [undefined, undefined],
      ['2026-11-07', undefined],
      ['2026-11-07', iso(new Date(win.to.getTime() - DAY))],
    ] as const) {
      const r = resolveSlotRange(f, t, NOW);
      const endOfToDay = Math.floor(r.to.getTime() / DAY) * DAY + DAY - 1;
      expect(r.from.getTime()).toBeGreaterThanOrEqual(win.from.getTime());
      expect(endOfToDay).toBeLessThan(win.to.getTime());
    }
  });
});

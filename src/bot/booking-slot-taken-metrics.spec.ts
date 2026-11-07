// Доля «время уже заняли» в блоке «Деньги» /stats (правило №8; аудит 2026-10,
// r2-1#2): форматтер на пустую базу, оба исхода порога и запрос count.
// Связка «отказ записан → виден в отчёте» — booking.create.spec.ts (событие)
// и money-metrics.service.spec.ts (render()).
import {
  countSlotTaken,
  formatSlotTaken,
  SLOT_TAKEN_ALERT,
} from './booking-slot-taken-metrics';

describe('formatSlotTaken', () => {
  it('пустая база: попыток не было — строки нет, без «0» и NaN', () => {
    expect(formatSlotTaken({ taken: 0, created: 0 })).toEqual([]);
  });

  it('записи были, отказов нет — «ни разу»', () => {
    expect(formatSlotTaken({ taken: 0, created: 4 })).toEqual([
      'Записаться пробовали за 7 дней: 4 раза; «время уже заняли» — ни разу.',
    ]);
  });

  it('один отказ на неделю — законная гонка, без подсветки', () => {
    const out = formatSlotTaken({ taken: 1, created: 3 });
    expect(out).toEqual([
      'Записаться пробовали за 7 дней: 4 раза; «время уже заняли» — 1 раз (25%).',
    ]);
  });

  it('много отказов при малой доле — без подсветки (порог по доле)', () => {
    const out = formatSlotTaken({ taken: 2, created: 98 }).join('\n');
    expect(out).not.toContain('⚠️');
    expect(out).toContain('2 раза (2%)');
  });

  it('выше порога — подсветка и что сделать, простыми словами', () => {
    const out = formatSlotTaken({
      taken: SLOT_TAKEN_ALERT.minTaken,
      created: 8,
    }).join('\n');
    expect(out).toContain(
      '⚠️ Записаться пробовали за 7 дней: 10 раз; «время уже заняли» — 2 раза (20%).',
    );
    expect(out).toContain('сверить свободные окна с расписанием');
    expect(out).not.toMatch(/409|слот|NaN|undefined/);
  });
});

describe('countSlotTaken', () => {
  it('отказы — только серверные строки (userId = null) за 7 дней; попытки — брони за те же 7 дней', async () => {
    const eventCount = jest.fn(async () => 2);
    const bookingCount = jest.fn(async () => 5);
    const now = Date.parse('2026-11-06T12:00:00Z');
    const since = new Date('2026-10-30T12:00:00Z');

    const res = await countSlotTaken(
      {
        analyticsEvent: { count: eventCount },
        booking: { count: bookingCount },
      } as never,
      now,
    );

    expect(res).toEqual({ taken: 2, created: 5 });
    expect(eventCount).toHaveBeenCalledWith({
      where: {
        name: 'booking_slot_taken',
        userId: null,
        createdAt: { gte: since },
      },
    });
    expect(bookingCount).toHaveBeenCalledWith({
      where: { createdAt: { gte: since } },
    });
  });
});

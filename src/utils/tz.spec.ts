import { localDate, localMidnightUTC } from './tz';

describe('localDate', () => {
  it('форматирует YYYY-MM-DD в UTC', () => {
    expect(localDate('UTC', new Date('2026-06-08T12:00:00Z'))).toBe('2026-06-08');
  });

  it('учитывает таймзону у границы суток (Токио +9 → следующий день)', () => {
    const base = new Date('2026-06-08T23:30:00Z');
    expect(localDate('Asia/Tokyo', base)).toBe('2026-06-09');
    expect(localDate('UTC', base)).toBe('2026-06-08');
  });

  it('без base использует текущее время → формат YYYY-MM-DD', () => {
    expect(localDate('UTC')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('западная таймзона может оставаться в предыдущем дне', () => {
    // 2026-06-08T05:00Z = 2026-06-07 22:00 в Лос-Анджелесе (PDT, -7)
    expect(localDate('America/Los_Angeles', new Date('2026-06-08T05:00:00Z'))).toBe('2026-06-07');
  });
});

describe('localMidnightUTC', () => {
  it('UTC: полночь = тот же день 00:00Z', () => {
    expect(localMidnightUTC('2026-06-08', 'UTC').toISOString()).toBe('2026-06-08T00:00:00.000Z');
  });

  it('Токио (+9): полночь 8 июня = 7 июня 15:00Z', () => {
    expect(localMidnightUTC('2026-06-08', 'Asia/Tokyo').toISOString()).toBe('2026-06-07T15:00:00.000Z');
  });

  it('Лос-Анджелес (PDT -7): полночь 8 июня = 8 июня 07:00Z', () => {
    expect(localMidnightUTC('2026-06-08', 'America/Los_Angeles').toISOString()).toBe('2026-06-08T07:00:00.000Z');
  });
});

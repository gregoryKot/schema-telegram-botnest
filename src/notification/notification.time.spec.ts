import {
  addDaysLocal,
  isQuietHours,
  localDateString,
  nextQuietEnd,
  nextSendAt,
  tzOffsetAt,
} from './notification.time';

describe('notification.time', () => {
  describe('addDaysLocal', () => {
    it('adds days within a month', () => {
      expect(addDaysLocal('2026-07-02', 3)).toBe('2026-07-05');
    });

    it('crosses month boundary', () => {
      expect(addDaysLocal('2026-07-30', 3)).toBe('2026-08-02');
    });

    it('crosses year boundary', () => {
      expect(addDaysLocal('2026-12-31', 1)).toBe('2027-01-01');
    });
  });

  describe('isQuietHours', () => {
    // 12:00 UTC = 15:00 Moscow (UTC+3)
    const noonUtc = new Date('2026-07-02T12:00:00Z');
    // 20:00 UTC = 23:00 Moscow
    const eveningUtc = new Date('2026-07-02T20:00:00Z');
    // 03:00 UTC = 06:00 Moscow
    const nightUtc = new Date('2026-07-02T03:00:00Z');

    it('wrap-around window 22-8: daytime is not quiet', () => {
      expect(isQuietHours('Europe/Moscow', 22, 8, noonUtc)).toBe(false);
    });

    it('wrap-around window 22-8: late evening is quiet', () => {
      expect(isQuietHours('Europe/Moscow', 22, 8, eveningUtc)).toBe(true);
    });

    it('wrap-around window 22-8: early morning is quiet', () => {
      expect(isQuietHours('Europe/Moscow', 22, 8, nightUtc)).toBe(true);
    });

    it('non-wrapping window 8-22: daytime is quiet', () => {
      expect(isQuietHours('Europe/Moscow', 8, 22, noonUtc)).toBe(true);
    });

    it('start === end disables quiet hours', () => {
      expect(isQuietHours('Europe/Moscow', 0, 0, eveningUtc)).toBe(false);
    });
  });

  describe('nextSendAt', () => {
    it('returns today when the hour is still ahead', () => {
      const now = new Date('2026-07-02T10:00:00Z'); // 13:00 Moscow
      const result = nextSendAt(21, 'Europe/Moscow', now);
      expect(result.toISOString()).toBe('2026-07-02T18:00:00.000Z'); // 21:00 MSK
    });

    it('returns tomorrow when the hour has passed', () => {
      const now = new Date('2026-07-02T19:00:00Z'); // 22:00 Moscow
      const result = nextSendAt(21, 'Europe/Moscow', now);
      expect(result.toISOString()).toBe('2026-07-03T18:00:00.000Z');
    });

    it('is DST-aware (Berlin summer = UTC+2)', () => {
      const now = new Date('2026-07-02T10:00:00Z');
      const result = nextSendAt(21, 'Europe/Berlin', now);
      expect(result.toISOString()).toBe('2026-07-02T19:00:00.000Z'); // 21:00 CEST
    });

    it('is DST-aware (Berlin winter = UTC+1)', () => {
      const now = new Date('2026-01-15T10:00:00Z');
      const result = nextSendAt(21, 'Europe/Berlin', now);
      expect(result.toISOString()).toBe('2026-01-15T20:00:00.000Z'); // 21:00 CET
    });
  });

  describe('nextQuietEnd', () => {
    it('returns next morning when inside night window', () => {
      const now = new Date('2026-07-02T20:30:00Z'); // 23:30 Moscow
      const result = nextQuietEnd('Europe/Moscow', 8, now);
      expect(result.toISOString()).toBe('2026-07-03T05:00:00.000Z'); // 08:00 MSK
    });

    it('returns today morning when before quiet end', () => {
      const now = new Date('2026-07-02T02:00:00Z'); // 05:00 Moscow
      const result = nextQuietEnd('Europe/Moscow', 8, now);
      expect(result.toISOString()).toBe('2026-07-02T05:00:00.000Z');
    });
  });

  describe('tzOffsetAt / localDateString', () => {
    it('Moscow offset is +3', () => {
      expect(
        tzOffsetAt('Europe/Moscow', new Date('2026-07-02T12:00:00Z')),
      ).toBe(3);
    });

    it('localDateString shifts across midnight', () => {
      // 22:00 UTC 2 июля = 01:00 3 июля в Москве
      expect(
        localDateString('Europe/Moscow', new Date('2026-07-02T22:00:00Z')),
      ).toBe('2026-07-03');
    });
  });
});

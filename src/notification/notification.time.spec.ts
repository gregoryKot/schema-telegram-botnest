import {
  addDaysLocal,
  daysBetweenLocal,
  isQuietHours,
  localDateString,
  nextQuietEnd,
  nextSendAt,
  tzOffsetAt,
  utcInstantForLocalHour,
} from './notification.time';
import {
  localMinutesOfDay,
  tzOffsetMinutes,
  utcOffsetLabel,
} from './tz-offset';

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

  // E12 (аудит 2026-11): смещение округлялось до часа — Kolkata (+5:30) давала
  // +6, конец тихих часов 08:00 превращался в 07:30 местного, очередь в 07:30
  // видела «тихо» и переносила на завтра 07:30. Отложенное не приходило никогда.
  describe('пояса не по целому часу (E12)', () => {
    const HALF = [
      { tz: 'Asia/Kolkata', minutes: 330, label: 'UTC+5:30' },
      { tz: 'Asia/Kathmandu', minutes: 345, label: 'UTC+5:45' },
      { tz: 'Europe/Moscow', minutes: 180, label: 'UTC+3' },
      { tz: 'America/New_York', minutes: -300, label: 'UTC-5' },
    ];
    const winter = new Date('2026-01-15T12:00:00Z');

    it.each(HALF)('$tz: смещение $minutes мин, подпись $label', (c) => {
      expect(tzOffsetMinutes(c.tz, winter)).toBe(c.minutes);
      expect(tzOffsetAt(c.tz, winter)).toBe(c.minutes / 60);
      expect(utcOffsetLabel(c.tz, winter)).toBe(c.label);
    });

    it.each(HALF)(
      '$tz: отложенное тихими часами приходит в 08:00 местного, и очередь его отпускает',
      ({ tz }) => {
        // 23:10 местного — внутри окна 22–8; очередь переносит на nextQuietEnd.
        const late = utcInstantForLocalHour('2026-07-02', 23, tz);
        const now = new Date(late.getTime() + 10 * 60_000);
        expect(isQuietHours(tz, 22, 8, now)).toBe(true);
        const deferred = nextQuietEnd(tz, 8, now);
        expect(localMinutesOfDay(tz, deferred)).toBe(8 * 60);
        expect(localDateString(tz, deferred)).toBe('2026-07-03');
        // В момент переноса очередь видит «не тихо» и отправляет, а не
        // переносит ещё раз — это и был вечный цикл.
        expect(isQuietHours(tz, 22, 8, deferred)).toBe(false);
        expect(nextQuietEnd(tz, 8, deferred).getTime()).toBeGreaterThan(
          deferred.getTime() + 23 * 3_600_000,
        );
      },
    );

    it('Kolkata: 08:00 местного — это 02:30 UTC', () => {
      expect(nextQuietEnd('Asia/Kolkata', 8, winter).toISOString()).toBe(
        '2026-01-16T02:30:00.000Z',
      );
      expect(nextSendAt(21, 'Asia/Kathmandu', winter).toISOString()).toBe(
        '2026-01-15T15:15:00.000Z',
      );
    });

    it('07:59 местного в Kolkata — ещё тихо, 08:00 — уже нет', () => {
      const eight = new Date('2026-01-16T02:30:00Z');
      expect(
        isQuietHours('Asia/Kolkata', 22, 8, new Date(eight.getTime() - 60_000)),
      ).toBe(true);
      expect(isQuietHours('Asia/Kolkata', 22, 8, eight)).toBe(false);
    });
  });

  describe('daysBetweenLocal', () => {
    it('считает календарные дни через границу месяца', () => {
      expect(daysBetweenLocal('2026-07-30', '2026-08-02')).toBe(3);
      expect(daysBetweenLocal('2026-07-02', '2026-07-02')).toBe(0);
    });
  });
});

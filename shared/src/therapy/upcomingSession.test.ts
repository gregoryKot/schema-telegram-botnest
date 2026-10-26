// Прошедшая nextSession не должна жить «следующей сессией»: при днях встреч
// она переезжает на ближайший такой день с тем же временем.
import { describe, it, expect } from 'vitest';
import { upcomingSession } from './upcomingSession';
import { forEachTimeZone } from '../utils/timeZone.test-helpers';

// 2026-10-26 — понедельник, 2026-10-17 и 2026-10-31 — субботы.
const TODAY = '2026-10-26';
const SAT = 6;

describe('upcomingSession', () => {
  it('будущая и сегодняшняя дата остаются как есть, даже при днях встреч', () => {
    expect(upcomingSession('2026-11-04T10:00', [SAT], TODAY)).toBe(
      '2026-11-04T10:00',
    );
    expect(upcomingSession('2026-10-26T07:00', [SAT], TODAY)).toBe(
      '2026-10-26T07:00',
    );
  });

  it('прошедшая дата при еженедельной субботе — ближайшая суббота с тем же временем', () => {
    expect(upcomingSession('2026-10-17T07:00', [SAT], TODAY)).toBe(
      '2026-10-31T07:00',
    );
  });

  it('берёт ближайший из нескольких дней; сегодняшний день встреч — сегодня', () => {
    expect(upcomingSession('2026-10-17T07:00', [SAT, 3], TODAY)).toBe(
      '2026-10-28T07:00',
    );
    expect(upcomingSession('2026-10-17T07:00', [1], TODAY)).toBe(
      '2026-10-26T07:00',
    );
  });

  it('без сохранённой даты — ближайший день встреч без времени', () => {
    expect(upcomingSession(null, [SAT], TODAY)).toBe('2026-10-31');
  });

  it('прошедшая дата без дней встреч и пустые данные — null', () => {
    expect(upcomingSession('2026-10-17T07:00', [], TODAY)).toBeNull();
    expect(upcomingSession('2026-10-17', null, TODAY)).toBeNull();
    expect(upcomingSession(null, undefined, TODAY)).toBeNull();
  });

  it('день недели не зависит от зоны машины', () => {
    forEachTimeZone((tz) => {
      expect(upcomingSession('2026-10-17T07:00', [SAT], TODAY), tz).toBe(
        '2026-10-31T07:00',
      );
    });
  });
});

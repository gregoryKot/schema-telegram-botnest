// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { sessionMoment } from './model';
import { dayIndex as sharedDayIndex } from '../../../../shared/src/needs/dayIndex';
import { trackerSummary } from './todayFeed';
import { summarizeDay } from '../../components/trackerOverlay/trackerFlow';
import { forEachTimeZone } from '../../../../shared/src/utils/timeZone.test-helpers';

describe('индекс дня: паритет с shared/needs/dayIndex', () => {
  it('главная, экран «Готово» трекера и общий модуль считают одну формулу', () => {
    const ids = ['a', 'b', 'c'];
    const ratings = { a: 3, b: 4, c: 8 };
    expect(summarizeDay(ids, ratings).index).toBe(sharedDayIndex(ids, ratings));
    expect(trackerSummary(ids, ratings).index).toBe(sharedDayIndex(ids, ratings));
    expect(trackerSummary(ids, { a: 3 }).index).toBe(sharedDayIndex(ids, { a: 3 }));
  });
});

describe('sessionMoment', () => {
  it('только день (дни встреч без времени) — локальная полночь того же дня в любой зоне', () => {
    forEachTimeZone((tz) => {
      const d = sessionMoment('2026-10-17');
      expect([d.getFullYear(), d.getMonth(), d.getDate()], tz).toEqual([2026, 9, 17]);
    });
  });
  it('момент с временем остаётся моментом', () => {
    expect(sessionMoment('2026-10-17T11:00:00.000Z').getTime()).toBe(Date.parse('2026-10-17T11:00:00.000Z'));
  });
});

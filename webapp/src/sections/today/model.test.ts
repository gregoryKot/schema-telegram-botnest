// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { deltaView, dayIndex, sessionMoment } from './model';
import { forEachTimeZone } from '../../../../shared/src/utils/timeZone.test-helpers';

describe('deltaView', () => {
  it('рост и падение со стрелкой, целые без дробной части', () => {
    expect(deltaView(8, 5)).toEqual({ text: '↑3', up: true });
    expect(deltaView(4, 6)).toEqual({ text: '↓2', up: false });
    expect(deltaView(5.5, 5)).toEqual({ text: '↑0.5', up: true });
  });
  it('нет вчерашней или сегодняшней оценки, либо разницы — null', () => {
    expect(deltaView(5, undefined)).toBeNull();
    expect(deltaView(undefined, 5)).toBeNull();
    expect(deltaView(5, 5)).toBeNull();
  });
});

describe('dayIndex', () => {
  it('среднее, когда оценены все потребности', () => {
    expect(dayIndex(['a', 'b'], { a: 4, b: 7 })).toBe(5.5);
  });
  it('не все оценены или потребностей нет — null', () => {
    expect(dayIndex(['a', 'b'], { a: 4 })).toBeNull();
    expect(dayIndex([], {})).toBeNull();
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

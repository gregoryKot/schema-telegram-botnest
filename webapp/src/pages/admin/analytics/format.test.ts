import { describe, it, expect } from 'vitest';
import type { AdminTherapistRow } from '../../../../../shared/src/analytics/adminAnalytics';
import { agoLabel, barHeights, dayReadout, indexFromX, peopleWord, seriesValues, sortTherapists } from './format';

const NOW = new Date('2026-11-24T12:00:00Z');

describe('agoLabel', () => {
  it('сегодня, вчера, N дней назад со склонением', () => {
    expect(agoLabel('2026-11-24T01:00:00Z', NOW)).toBe('сегодня');
    expect(agoLabel('2026-11-23T23:00:00Z', NOW)).toBe('вчера');
    expect(agoLabel('2026-11-21T10:00:00Z', NOW)).toBe('3 дня назад');
    expect(agoLabel('2026-11-03T10:00:00Z', NOW)).toBe('21 день назад');
    expect(agoLabel('2026-10-01T10:00:00Z', NOW)).toBe('54 дня назад');
  });
  it('нет даты или мусор — null', () => {
    expect(agoLabel(null, NOW)).toBeNull();
    expect(agoLabel('не дата', NOW)).toBeNull();
  });
});

const row = (id: string, o: Partial<AdminTherapistRow>): AdminTherapistRow => ({
  id, name: id, lastActive: null, activeDays: 0, clients: { active: 0, pending: 0, ended: 0, virtual: 0 },
  actions: { notes: 0, tasks: 0, planItems: 0, guideMarks: 0, conceptualizations: 0, customModes: 0, invites: 0 },
  total: 0, daily: [], ...o,
});

describe('sortTherapists', () => {
  const rows = [
    row('b', { total: 5, activeDays: 2, clients: { active: 1, pending: 0, ended: 0, virtual: 0 }, lastActive: '2026-11-01T00:00:00Z' }),
    row('a', { total: 9, activeDays: 1, clients: { active: 0, pending: 0, ended: 0, virtual: 0 }, lastActive: null }),
    row('c', { total: 0, clients: { active: 2, pending: 2, ended: 0, virtual: 0 }, lastActive: '2026-11-20T00:00:00Z' }),
  ];
  it('по активности — больше действий выше', () => expect(sortTherapists(rows, 'activity').map((r) => r.id)).toEqual(['a', 'b', 'c']));
  it('по клиентам — действующие и ждущие', () => expect(sortTherapists(rows, 'clients').map((r) => r.id)).toEqual(['c', 'b', 'a']));
  it('по давности — свежие выше, без захода внизу', () => expect(sortTherapists(rows, 'recent').map((r) => r.id)).toEqual(['c', 'b', 'a']));
  it('исходный массив не меняется', () => { sortTherapists(rows, 'clients'); expect(rows[0].id).toBe('b'); });
});

describe('график', () => {
  it('barHeights — доля от максимума, пустой ряд без NaN', () => {
    expect(barHeights([0, 5, 10])).toEqual([0, 50, 100]);
    expect(barHeights([0, 0])).toEqual([0, 0]);
    expect(barHeights([])).toEqual([]);
  });
  it('indexFromX — столбик под точкой, края прижаты', () => {
    expect(indexFromX(50, 0, 100, 10)).toBe(5);
    expect(indexFromX(-20, 0, 100, 10)).toBe(0);
    expect(indexFromX(500, 0, 100, 10)).toBe(9);
    expect(indexFromX(5, 0, 0, 10)).toBe(-1);
  });
  it('выбор ряда и подпись дня', () => {
    const daily = [{ date: '2026-11-23', active: 3, newUsers: 1, events: 7 }];
    expect(seriesValues(daily, 'events')).toEqual([7]);
    expect(dayReadout(daily[0], 'newUsers')).toMatch(/новых 1$/);
  });
  it('склонение людей', () => expect([1, 2, 5, 11, 21].map(peopleWord)).toEqual(['1 человек', '2 человека', '5 человек', '11 человек', '21 человек']));
});

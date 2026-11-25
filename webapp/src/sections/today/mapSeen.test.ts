// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { hasNewOnMap, markMapSeen, readMapSeen } from './mapSeen';

const at = (createdAt: string) => ({ createdAt });

describe('hasNewOnMap', () => {
  it('пустая карта — отметки нет', () => {
    expect(hasNewOnMap([], null)).toBe(false);
    expect(hasNewOnMap([], '2026-11-20T10:00:00.000Z')).toBe(false);
  });
  it('карту не открывали, метки есть — отметка есть', () => {
    expect(hasNewOnMap([at('2026-11-20T10:00:00.000Z')], null)).toBe(true);
  });
  it('метка позже открытия — отметка; раньше или в тот же миг — нет', () => {
    const seen = '2026-11-20T10:00:00.000Z';
    expect(hasNewOnMap([at('2026-11-19T10:00:00.000Z'), at('2026-11-21T08:00:00.000Z')], seen)).toBe(true);
    expect(hasNewOnMap([at('2026-11-19T10:00:00.000Z'), at(seen)], seen)).toBe(false);
  });
  it('сравнивает моменты, а не строки: смещение пояса не ломает', () => {
    expect(hasNewOnMap([at('2026-11-20T12:30:00+03:00')], '2026-11-20T10:00:00.000Z')).toBe(false);
  });
  it('битое значение «видел» — как будто не открывали', () => {
    expect(hasNewOnMap([at('2026-11-20T10:00:00.000Z')], 'мусор')).toBe(true);
  });
});

describe('mapSeen: сохранил → нашёл', () => {
  beforeEach(() => localStorage.clear());
  it('markMapSeen пишет момент, который потом гасит отметку', () => {
    expect(readMapSeen()).toBeNull();
    markMapSeen(new Date('2026-11-20T10:00:00.000Z'));
    expect(readMapSeen()).toBe('2026-11-20T10:00:00.000Z');
    expect(hasNewOnMap([at('2026-11-19T10:00:00.000Z')], readMapSeen())).toBe(false);
  });
});

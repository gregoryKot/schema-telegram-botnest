// Инварианты реестра «с чем путают режим» (правило №4 CLAUDE.md): a≠b, нет
// дублей пары (в т.ч. перевёрнутых), каждый из 35 modeId покрыт хотя бы
// одной парой, getDoubtsForMode разворачивает симметрию с обеих сторон.
import { describe, it, expect } from 'vitest';
import { MODE_DOUBT_PAIRS, getDoubtsForMode } from './index';
import { ALL_TEST_MODE_IDS } from '../modeTest';

describe('MODE_DOUBT_PAIRS — структурные инварианты', () => {
  it('ровно 38 пар', () => {
    expect(MODE_DOUBT_PAIRS).toHaveLength(38);
  });

  it('a никогда не равен b', () => {
    for (const pair of MODE_DOUBT_PAIRS) {
      expect(pair.a, JSON.stringify(pair)).not.toBe(pair.b);
    }
  });

  it('нет дублей пары, включая перевёрнутые (a,b)/(b,a)', () => {
    const seen = new Set<string>();
    for (const pair of MODE_DOUBT_PAIRS) {
      const key = [pair.a, pair.b].sort().join('↔');
      expect(seen.has(key), `дубль пары: ${key}`).toBe(false);
      seen.add(key);
    }
  });

  it('gist и check непустые для каждой пары', () => {
    for (const pair of MODE_DOUBT_PAIRS) {
      expect(pair.gist.trim().length, JSON.stringify(pair)).toBeGreaterThan(0);
      expect(pair.check.trim().length, JSON.stringify(pair)).toBeGreaterThan(0);
    }
  });

  it('каждый из 35 modeId теста встречается хотя бы в одной паре', () => {
    const covered = new Set<string>();
    for (const pair of MODE_DOUBT_PAIRS) {
      covered.add(pair.a);
      covered.add(pair.b);
    }
    const missing = ALL_TEST_MODE_IDS.filter((id) => !covered.has(id));
    expect(missing).toEqual([]);
  });

  it('в парах нет id, отсутствующих в ALL_TEST_MODE_IDS (опечатка модели)', () => {
    const known = new Set(ALL_TEST_MODE_IDS);
    const unknown = new Set<string>();
    for (const pair of MODE_DOUBT_PAIRS) {
      if (!known.has(pair.a)) unknown.add(pair.a);
      if (!known.has(pair.b)) unknown.add(pair.b);
    }
    expect([...unknown]).toEqual([]);
  });
});

describe('getDoubtsForMode — симметрия видна с обеих сторон', () => {
  it('vulnerable_child ↔ helpless_surrenderer видна с обеих сторон', () => {
    const fromA = getDoubtsForMode('vulnerable_child');
    const fromB = getDoubtsForMode('helpless_surrenderer');
    expect(fromA.some((e) => e.otherId === 'helpless_surrenderer')).toBe(true);
    expect(fromB.some((e) => e.otherId === 'vulnerable_child')).toBe(true);
  });

  it('возвращает пустой массив для режима без явных пар в тесте (валидный ответ)', () => {
    expect(getDoubtsForMode('not_a_real_mode')).toEqual([]);
  });

  it('каждый режим из ALL_TEST_MODE_IDS получает непустой список соседей', () => {
    for (const id of ALL_TEST_MODE_IDS) {
      expect(getDoubtsForMode(id).length, id).toBeGreaterThan(0);
    }
  });

  it('каждая запись содержит непустые gist/check и валидный otherId', () => {
    const known = new Set(ALL_TEST_MODE_IDS);
    for (const id of ALL_TEST_MODE_IDS) {
      for (const entry of getDoubtsForMode(id)) {
        expect(known.has(entry.otherId), entry.otherId).toBe(true);
        expect(entry.gist.trim().length).toBeGreaterThan(0);
        expect(entry.check.trim().length).toBeGreaterThan(0);
      }
    }
  });
});

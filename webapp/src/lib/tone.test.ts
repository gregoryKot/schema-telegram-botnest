import { describe, it, expect } from 'vitest';
import { SCHEMA_DOMAINS, MODE_GROUPS } from '../../../shared/src/schemaTherapy/schemaTherapyData';
import { NEED_ORDER } from '../../../shared/src/needs/types';
import { DOMAIN_HUE, MODE_GROUP_HUE, NEED_HUE, hueStyle, indexLevel } from './tone';

describe('tone: реестры оттенков сверены с данными', () => {
  it('у каждого домена схем есть оттенок, и все пять разные', () => {
    const ids = SCHEMA_DOMAINS.map((d) => d.id);
    expect(Object.keys(DOMAIN_HUE).sort()).toEqual([...ids].sort());
    expect(new Set(ids.map((id) => DOMAIN_HUE[id])).size).toBe(ids.length);
  });
  it('у каждой группы режимов есть оттенок', () => {
    expect(Object.keys(MODE_GROUP_HUE).sort()).toEqual(MODE_GROUPS.map((g) => g.id).sort());
  });
  it('у каждой потребности есть оттенок', () => {
    expect(Object.keys(NEED_HUE).sort()).toEqual([...NEED_ORDER].sort());
  });
});

describe('tone: indexLevel', () => {
  it.each([
    [8, 'ok'], [7, 'ok'], [6.9, 'warn'], [5, 'warn'], [4.9, 'err'], [0, 'err'],
    [null, 'none'], [undefined, 'none'], [Number.NaN, 'none'],
  ] as const)('%s → %s', (v, level) => {
    expect(indexLevel(v)).toBe(level);
  });
});

describe('tone: hueStyle', () => {
  it('кладёт только --h, без hue — нейтральный оттенок', () => {
    expect(hueStyle(28)).toEqual({ '--h': 28 });
    expect(hueStyle(240)).toEqual({ '--h': 240 });
    expect(hueStyle(undefined)).toEqual({ '--h': 70 });
  });
});

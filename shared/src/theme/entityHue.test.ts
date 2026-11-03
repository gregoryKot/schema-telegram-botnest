import { describe, it, expect } from 'vitest';
import { DOMAIN_HUE, MODE_GROUP_HUE, NEED_HUE, toneHex } from './entityHue';
import {
  SCHEMA_DOMAINS,
  MODE_GROUPS,
} from '../schemaTherapy/schemaTherapyData';
import { NEED_ORDER } from '../needs/needData';

const ch = (hex: string) =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

describe('toneHex', () => {
  it.each([
    [28, '#b75b51'],
    [70, '#a76c12'],
    [135, '#5a8a3d'],
    [145, '#478d4b'],
    [240, '#2382ba'],
    [310, '#9064af'],
  ])('hue %i совпадает с oklch(0.58 0.12 h) в sRGB (±1)', (h, hex) => {
    const got = ch(toneHex(h));
    ch(hex).forEach((v, i) =>
      expect(Math.abs(got[i] - v)).toBeLessThanOrEqual(1),
    );
  });

  it('формат #rrggbb для всех hue из таблиц', () => {
    const all = [
      ...Object.values(DOMAIN_HUE),
      ...Object.values(MODE_GROUP_HUE),
      ...Object.values(NEED_HUE),
    ];
    for (const h of all) expect(toneHex(h)).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('таблицы hue', () => {
  it('ключи совпадают с контентом', () => {
    expect(Object.keys(DOMAIN_HUE).sort()).toEqual(
      SCHEMA_DOMAINS.map((d) => d.id).sort(),
    );
    expect(Object.keys(MODE_GROUP_HUE).sort()).toEqual(
      MODE_GROUPS.map((g) => g.id).sort(),
    );
    expect(Object.keys(NEED_HUE).sort()).toEqual([...NEED_ORDER].sort());
  });
  it('hue доменов попарно различны', () => {
    const v = Object.values(DOMAIN_HUE);
    expect(new Set(v).size).toBe(v.length);
  });
});

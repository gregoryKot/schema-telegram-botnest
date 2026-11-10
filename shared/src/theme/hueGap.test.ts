import { describe, it, expect } from 'vitest';
import { NEIGHBOUR_HUE_GAP, hueGap, hueTooNear } from './hueGap';

describe('hueGap — расстояние по кругу оттенков', () => {
  it('симметрично и через 0°: слива 310 и глина 28 — 78°', () => {
    expect(hueGap(310, 28)).toBe(78);
    expect(hueGap(28, 310)).toBe(78);
  });
  it('глина 28 и персик 45 ближе зазора соседей, небо 240 — дальше', () => {
    expect(hueGap(28, 45)).toBeLessThan(NEIGHBOUR_HUE_GAP);
    expect(hueGap(28, 240)).toBeGreaterThanOrEqual(NEIGHBOUR_HUE_GAP);
  });
  it('тот же оттенок — 0, противоположный — 180', () => {
    expect(hueGap(28, 28)).toBe(0);
    expect(hueGap(0, 180)).toBe(180);
  });
});

describe('hueTooNear — два листа подряд читаются одним', () => {
  it('глина 28 и роза 25, тот же оттенок — близко; глина и небо 240, персик 45 и солома 70 на 25° — по зазору', () => {
    expect(hueTooNear(28, 25)).toBe(true);
    expect(hueTooNear(310, 310)).toBe(true);
    expect(hueTooNear(28, 240)).toBe(false);
    expect(hueTooNear(45, 70)).toBe(true);
    expect(hueTooNear(28, 28 + NEIGHBOUR_HUE_GAP)).toBe(false);
  });
  it('второго листа нет (null/undefined) — не близко', () => {
    expect(hueTooNear(28, null)).toBe(false);
    expect(hueTooNear(undefined, 28)).toBe(false);
  });
});

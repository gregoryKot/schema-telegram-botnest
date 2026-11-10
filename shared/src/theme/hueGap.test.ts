import { describe, it, expect } from 'vitest';
import { NEIGHBOUR_HUE_GAP, hueGap } from './hueGap';

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

import { describe, expect, it } from 'vitest';
import { isAnyOverlayOpen, OVERLAY_SHEET_KEYS } from './anyOverlayOpen';
import type { SheetsValues } from './useSheets';

const closed = Object.fromEntries(
  OVERLAY_SHEET_KEYS.map((k) => [k, false]),
) as Pick<SheetsValues, (typeof OVERLAY_SHEET_KEYS)[number]>;
const noExtras = {
  newDiaryEntry: null,
  celebrationStreak: null,
  onboardingVisible: false,
};

describe('isAnyOverlayOpen', () => {
  it('всё закрыто — false', () => {
    expect(isAnyOverlayOpen(closed, noExtras)).toBe(false);
  });

  it.each(OVERLAY_SHEET_KEYS)('открыта шторка %s — true', (key) => {
    expect(isAnyOverlayOpen({ ...closed, [key]: true }, noExtras)).toBe(true);
  });

  it('экраны вне useSheets тоже считаются оверлеем', () => {
    expect(
      isAnyOverlayOpen(closed, { ...noExtras, newDiaryEntry: 'schema' }),
    ).toBe(true);
    expect(
      isAnyOverlayOpen(closed, { ...noExtras, celebrationStreak: 3 }),
    ).toBe(true);
    expect(
      isAnyOverlayOpen(closed, { ...noExtras, onboardingVisible: true }),
    ).toBe(true);
  });

  it('список ключей отсортирован и без дублей (правило №13)', () => {
    const sorted = [...OVERLAY_SHEET_KEYS].sort();
    expect([...OVERLAY_SHEET_KEYS]).toEqual(sorted);
    expect(new Set(OVERLAY_SHEET_KEYS).size).toBe(OVERLAY_SHEET_KEYS.length);
  });
});

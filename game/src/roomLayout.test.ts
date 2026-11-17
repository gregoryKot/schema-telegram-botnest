import { describe, it, expect, vi } from 'vitest';
import { ROOM, WALL_PERIOD, glowLeft, onFloor } from './roomLayout';

describe('roomLayout', () => {
  it('пятно света встаёт в сетку обоев и остаётся под торшером', () => {
    for (const x of [384, 400, 2450, 4300]) {
      expect(Math.abs(glowLeft(x) % WALL_PERIOD)).toBe(0);
      expect(Math.abs(glowLeft(x) + 192 - x)).toBeLessThanOrEqual(WALL_PERIOD / 2);
    }
  });

  it('мебель над ямой и у края арены отбрасывается', () => {
    expect(onFloor([100, 890, 1000, 1070, 1100, 1990], 20, 2000, [{ s: 900, e: 1060 }])).toEqual([100, 1100]);
    expect(onFloor([500], 20, 520, [])).toEqual([]);
  });

  it('в главе 2 вся напольная обстановка стоит на полу', async () => {
    vi.stubGlobal('window', {}); // chapters тянет i18n, а тот смотрит в window
    const { pits, arenaW, decor } = (await import('./chapters')).CHAPTERS.chapter2;
    const floor = [...ROOM.shelves, ...ROOM.plants, ROOM.desk, ROOM.door, ...(decor?.lamps ?? [])];
    expect(onFloor(floor, 30, arenaW, pits)).toEqual(floor);
  });
});

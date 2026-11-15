// Сверка hex группы режимов (canvas, SVG листа «Схема — это что?») с таблицей тонов MODE_GROUP_HUE (правило №4).
import { describe, it, expect } from 'vitest';
import { MODE_GROUP_COLOR } from './modeGroupColor';
import { MODE_GROUP_HUE, oklchHex } from './entityHue';

/** Группа MODE_GROUP_COLOR → группы MODE_GROUP_HUE с её тоном: три копинга делят один. */
const HUE_GROUPS: Record<keyof typeof MODE_GROUP_COLOR, string[]> = {
  child: ['child'],
  coping: ['coping_surrender', 'coping_avoidance', 'coping_overcompensation'],
  critic: ['critic'],
  healthy: ['healthy'],
};

describe('MODE_GROUP_COLOR ↔ MODE_GROUP_HUE', () => {
  it.each(Object.entries(HUE_GROUPS))(
    '%s: hex — тон .tone-fill с hue каждой своей группы',
    (group, hueGroups) => {
      const { hex } = MODE_GROUP_COLOR[group as keyof typeof MODE_GROUP_COLOR];
      expect(hex).toMatch(/^#[0-9a-f]{6}$/);
      for (const g of hueGroups) {
        expect(oklchHex(0.58, 0.12, MODE_GROUP_HUE[g])).toBe(hex);
      }
    },
  );

  it('каждая группа MODE_GROUP_HUE покрыта ровно одним цветом, лишнего цвета нет', () => {
    expect(Object.keys(HUE_GROUPS).sort()).toEqual(
      Object.keys(MODE_GROUP_COLOR).sort(),
    );
    expect(Object.values(HUE_GROUPS).flat().sort()).toEqual(
      Object.keys(MODE_GROUP_HUE).sort(),
    );
  });
});

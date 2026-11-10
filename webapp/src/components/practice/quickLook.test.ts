// Литералы вида быстрых практик (quickLook.ts) совпадают с таблицей ENTITY_LOOK (правило №4).
import { describe, it, expect } from 'vitest';
import { ENTITY_LOOK } from '../../../../shared/src/theme/entityLook';
import { QUICK_LOOK } from './quickLook';

describe('QUICK_LOOK', () => {
  it.each(Object.keys(QUICK_LOOK) as (keyof typeof QUICK_LOOK)[])('%s — бумага и знак из ENTITY_LOOK', (id) => {
    const { hue, sign } = ENTITY_LOOK[id];
    expect(QUICK_LOOK[id]).toEqual({ hue, sign });
  });
});

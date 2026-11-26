import { describe, it, expect } from 'vitest';
import { ENTITY_LOOK, SIGN_KEYS } from '../../../../shared/src/theme/entityLook';
import { KIND_LOOK } from './kindLook';
import { MAP_KINDS } from './mapKinds';

const apart = (a: number, b: number) => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d); };

describe('KIND_LOOK — знак и бумага типа карты', () => {
  it('у каждого типа из MAP_KINDS есть вид, знак — из общего набора', () => {
    expect(new Set(Object.keys(KIND_LOOK))).toEqual(new Set(MAP_KINDS));
    for (const k of MAP_KINDS) expect(SIGN_KEYS, k).toContain(KIND_LOOK[k].sign);
  });

  it('знаки и оттенки — от сущностей: схемы, режимы, «Что случилось»', () => {
    expect(KIND_LOOK.concept).toEqual({ hue: ENTITY_LOOK.schemas.hue, sign: ENTITY_LOOK.schemas.sign });
    expect(KIND_LOOK.personality).toEqual({ hue: ENTITY_LOOK.modes.hue, sign: ENTITY_LOOK.modes.sign });
    expect(KIND_LOOK.problem).toEqual({ hue: ENTITY_LOOK.case.hue, sign: ENTITY_LOOK.case.sign });
  });

  it('соседние плитки не ближе 40°: в ряду из пяти и в рядах по три (сосед сбоку и сосед снизу)', () => {
    const hues = MAP_KINDS.map((k) => KIND_LOOK[k].hue);
    for (let i = 1; i < hues.length; i++) expect(apart(hues[i - 1], hues[i]), `${MAP_KINDS[i - 1]}–${MAP_KINDS[i]}`).toBeGreaterThanOrEqual(40);
    for (let i = 3; i < hues.length; i++) expect(apart(hues[i - 3], hues[i]), `${MAP_KINDS[i - 3]} над ${MAP_KINDS[i]}`).toBeGreaterThanOrEqual(40);
    expect(new Set(hues).size).toBe(hues.length);
  });
});

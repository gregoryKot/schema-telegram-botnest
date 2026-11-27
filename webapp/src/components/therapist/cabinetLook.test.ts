import { describe, it, expect } from 'vitest';
import { hueGap, NEIGHBOUR_HUE_GAP } from '../../../../shared/src/theme/hueGap';
import {
  PRIVACY_TILE_LOOK, SESSIONS_LOOK, TODAY_COUNTER_LOOK,
} from './cabinetLook';

const apart = (hues: number[]) => hues.every((h, i) => i === 0 || hueGap(h, hues[i - 1]) >= NEIGHBOUR_HUE_GAP);

describe('cabinetLook', () => {
  it('счётчики — соседние плитки дальше 40°; сессии — небо с Talk', () => {
    const c = TODAY_COUNTER_LOOK;
    expect(apart([c.active.hue, c.sessions.hue, c.attention.hue])).toBe(true);
    expect([c.active.sign, c.sessions.sign, c.attention.sign]).toEqual(['strokes', 'talk', 'heart']);
    expect(SESSIONS_LOOK).toMatchObject({ hue: 240, sign: 'talk' });
  });

  it('дисклеймер 2×2: соседи по строке и по столбцу дальше 40°', () => {
    const h = PRIVACY_TILE_LOOK.map((t) => t.hue);
    expect(apart([h[0], h[1]]) && apart([h[2], h[3]]) && apart([h[0], h[2]]) && apart([h[1], h[3]])).toBe(true);
    const sign = Object.fromEntries(PRIVACY_TILE_LOOK.map((t) => [t.key, t.sign]));
    expect(sign).toEqual({ encrypt: 'limits', access: 'talk', login: 'brand', delete: 'check' });
  });
});

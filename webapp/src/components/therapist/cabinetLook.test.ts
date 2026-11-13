import { describe, it, expect } from 'vitest';
import { SCHEMA_DOMAINS } from '../../schemaTherapyData';
import { hueGap, NEIGHBOUR_HUE_GAP } from '../../../../shared/src/theme/hueGap';
import { DOMAIN_HUE } from '../../lib/tone';
import {
  BOARD_COLUMN_LOOK, PRIVACY_TILE_LOOK, SESSIONS_LOOK, TODAY_COUNTER_LOOK, clientSign, leadingDomain,
} from './cabinetLook';

const [d1, d2] = SCHEMA_DOMAINS;
const ids = (d: (typeof SCHEMA_DOMAINS)[number], n: number) => d.schemas.slice(0, n).map((s) => s.id);
const apart = (hues: number[]) => hues.every((h, i) => i === 0 || hueGap(h, hues[i - 1]) >= NEIGHBOUR_HUE_GAP);

describe('cabinetLook', () => {
  it('счётчики, колонки доски — соседние плитки дальше 40°; сессии — небо с Talk', () => {
    const c = TODAY_COUNTER_LOOK;
    expect(apart([c.active.hue, c.sessions.hue, c.attention.hue])).toBe(true);
    expect([c.active.sign, c.sessions.sign, c.attention.sign]).toEqual(['strokes', 'talk', 'heart']);
    const b = BOARD_COLUMN_LOOK;
    expect(apart([b.open.hue, b.done.hue, b.failed.hue])).toBe(true);
    expect(b.done.sign).toBe('check');
    expect(SESSIONS_LOOK).toMatchObject({ hue: 240, sign: 'talk' });
  });

  it('дисклеймер 2×2: соседи по строке и по столбцу дальше 40°', () => {
    const h = PRIVACY_TILE_LOOK.map((t) => t.hue);
    expect(apart([h[0], h[1]]) && apart([h[2], h[3]]) && apart([h[0], h[2]]) && apart([h[1], h[3]])).toBe(true);
    const sign = Object.fromEntries(PRIVACY_TILE_LOOK.map((t) => [t.key, t.sign]));
    expect(sign).toEqual({ encrypt: 'limits', access: 'talk', login: 'brand', delete: 'check' });
  });

  it('ведущий домен — где схем больше; равенство или пусто — без ведущего', () => {
    expect(leadingDomain([...ids(d1, 2), ...ids(d2, 1)])).toBe(d1.id);
    expect(leadingDomain([...ids(d1, 1), ...ids(d2, 1)])).toBeNull();
    expect(leadingDomain([])).toBeNull();
    expect(leadingDomain(['нет-такой-схемы'])).toBeNull();
  });

  it('знак клиента: офлайн — знак продукта, иначе домен; без данных — ничего', () => {
    expect(clientSign({ telegramId: -7, schemaIds: ids(d1, 2) })).toEqual({ kind: 'offline' });
    expect(clientSign({ telegramId: 5, schemaIds: ids(d2, 1) })).toEqual({ kind: 'domain', domainId: d2.id, hue: DOMAIN_HUE[d2.id] });
    expect(clientSign({ telegramId: 5, schemaIds: [] })).toBeNull();
  });
});

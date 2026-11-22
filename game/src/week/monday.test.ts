import { describe, expect, it, vi } from 'vitest';

// constants.ts смотрит на window (тач или нет) — в node его нет
vi.hoisted(() => vi.stubGlobal('window', {}));
import { PHYS } from '../constants';
import { MONDAY, PEAK_X } from './monday';
import { doorX, gateInReach } from './chapter';
import { agree, jumpFactor, newWeekState } from './habits';

const jumpH = (factor: number) => (PHYS.jumpVel * factor) ** 2 / (2 * PHYS.gravity);

describe('«Понедельник» — данные главы (общие правила глав — chapters.test.ts)', () => {
  it('хук учит всем трём привычкам: на пути стопка, шум и человек', () => {
    const blocking = MONDAY.gates.filter(g => g.kind !== 'pile' || g.h >= jumpH(1));
    expect(new Set(blocking.map(g => g.kind))).toEqual(new Set(['pile', 'noise', 'person']));
    expect(PEAK_X).toBeGreaterThan(Math.max(...MONDAY.gates.map(g => g.x)));
  });
  it('блоки улицы и низкие стопки перепрыгиваются и с рюкзаком; стопка после коллеги — только без него', () => {
    const light = jumpH(1), loaded = jumpH(jumpFactor(agree(newWeekState(0), true)));
    for (const b of MONDAY.blocks) expect(b.h).toBeLessThan(light);
    const personX = MONDAY.gates.find(p => p.kind === 'person')!.x;
    const next = MONDAY.gates.find(g => g.kind === 'pile' && g.x > personX)!;
    expect(next.h).toBeLessThan(light);
    expect(next.h).toBeGreaterThan(loaded);
    for (const g of MONDAY.gates.filter(p => p.kind === 'pile' && p.x > next.x)) expect(g.h).toBeLessThan(loaded);
  });
});

describe('преграды и дверь', () => {
  const gates = [{ x: 100, kind: 'pile' as const, open: false }, { x: 300, kind: 'person' as const, open: false }];
  it('привычка убирает только свою преграду и только рядом', () => {
    expect(gateInReach(gates, 'overwork', 60, 110)).toBe(gates[0]);
    expect(gateInReach(gates, 'agree', 60, 110)).toBeUndefined();
    expect(gateInReach(gates, 'overwork', 400, 110)).toBeUndefined();
    expect(gateInReach([{ ...gates[0], open: true }], 'overwork', 60, 110)).toBeUndefined();
  });
  it('пока сбой не назван, дверь не приближается, сколько ни беги; после названия стоит на месте', () => {
    const d = MONDAY.door;
    let door = d.x;
    for (let px = d.x; px < d.x + 5000; px += 230) {
      door = doorX(door, px, true, false, d);
      expect(door - px).toBeGreaterThanOrEqual(d.keepAway);
    }
    expect(doorX(d.x, d.x - 1000, true, false, d)).toBe(d.x);
    expect(doorX(d.x, d.x, true, true, d)).toBe(d.x);
    expect(doorX(d.x, d.x, false, false, d)).toBe(d.x);
  });
});

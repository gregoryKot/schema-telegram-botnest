import { describe, expect, it, vi } from 'vitest';

// constants.ts смотрит на window (тач или нет) — в node его нет
vi.hoisted(() => vi.stubGlobal('window', {}));
import { PHYS } from '../constants';
import { M } from '../i18n/messages';
import { MONDAY, OPENS, doorX, gateInReach, type Act } from './monday';
import { agree, jumpFactor, newWeekState } from './habits';

const jumpH = (factor: number) => (PHYS.jumpVel * factor) ** 2 / (2 * PHYS.gravity);

describe('«Понедельник» — данные главы', () => {
  it('каждая привычка открывается до первой преграды, которую она убирает', () => {
    for (const g of MONDAY.gates) {
      const beat = MONDAY.beats.find(b => b.reveal === OPENS[g.kind]);
      expect(beat, g.kind).toBeDefined();
      expect(beat!.x).toBeLessThan(g.x);
    }
  });
  it('ПАУЗУ места главы не открывают: она появляется только у двери', () => {
    expect(MONDAY.beats.some(b => b.reveal === ('pause' satisfies Act))).toBe(false);
    expect(MONDAY.door.peakX).toBeGreaterThan(Math.max(...MONDAY.gates.map(g => g.x)));
  });
  it('места идут по порядку, часы не идут назад, строки есть в каталоге', () => {
    const xs = MONDAY.beats.map(b => b.x);
    expect([...xs].sort((a, b) => a - b)).toEqual(xs);
    const clocks = [MONDAY.startClock, ...MONDAY.beats.flatMap(b => (b.clock ? [b.clock] : []))];
    expect([...clocks].sort((a, b) => a - b)).toEqual(clocks);
    const keys = [MONDAY.title, MONDAY.pause.question, ...MONDAY.pause.options, MONDAY.end.bossLine,
      ...MONDAY.beats.flatMap(b => [...(b.say ? [b.say] : []), ...(b.notifs ?? [])])];
    for (const k of keys) expect(M[k], k).toBeDefined();
  });
  it('утренние блоки перепрыгиваются; стопка после коллеги — только без рюкзака', () => {
    const light = jumpH(1), loaded = jumpH(jumpFactor(agree(newWeekState(0), true)));
    for (const b of MONDAY.blocks) expect(b.h).toBeLessThan(light);
    const after = MONDAY.gates.filter(g => g.kind === 'pile' && g.x > MONDAY.gates.find(p => p.kind === 'person')!.x);
    expect(after.length).toBeGreaterThan(0);
    for (const g of after) { expect(g.h).toBeLessThan(light); expect(g.h).toBeGreaterThan(loaded); }
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
  it('на пике дверь держится впереди; после названия стоит на месте', () => {
    const d = MONDAY.door;
    expect(doorX(d.x, d.x, true, false, d)).toBe(d.x + d.keepAway);
    expect(doorX(d.x, d.x - 1000, true, false, d)).toBe(d.x);
    expect(doorX(d.x, d.x, true, true, d)).toBe(d.x);
    expect(doorX(d.x, d.x, false, false, d)).toBe(d.x);
  });
});

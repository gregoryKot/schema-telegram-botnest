import { describe, expect, it, vi } from 'vitest';

// constants.ts смотрит на window (тач или нет) — в node его нет
vi.hoisted(() => vi.stubGlobal('window', {}));
import { PHYS } from '../constants';
import { M } from '../i18n/messages';
import { MONDAY, OPENS, PEAK_X, doorX, gateInReach, type Act } from './monday';
import { secondsTo } from './run';
import { agree, jumpFactor, newWeekState } from './habits';

const jumpH = (factor: number) => (PHYS.jumpVel * factor) ** 2 / (2 * PHYS.gravity);

describe('«Понедельник» — данные главы', () => {
  it('преграда, которую не перепрыгнуть, встаёт только после кнопки своей привычки', () => {
    const blocking = MONDAY.gates.filter(g => g.kind !== 'pile' || g.h >= jumpH(1));
    expect(new Set(blocking.map(g => g.kind))).toEqual(new Set(['pile', 'noise', 'person']));
    for (const g of blocking) {
      const beat = MONDAY.beats.find(b => b.reveal === OPENS[g.kind]);
      expect(beat, g.kind).toBeDefined();
      expect(beat!.x).toBeLessThan(g.x);
    }
  });
  it('ПАУЗУ места главы не открывают: она появляется только на пике, после всех преград', () => {
    expect(MONDAY.beats.some(b => b.reveal === ('pause' satisfies Act))).toBe(false);
    expect(PEAK_X).toBeGreaterThan(Math.max(...MONDAY.gates.map(g => g.x)));
  });
  it('спокойные кадры — шагом и трусцой, сбой — бегом; до сбоя бежать не заставляют', () => {
    const glitchAt = MONDAY.beats.find(b => b.glitch)!;
    expect(MONDAY.startPace).toBe('walk');
    expect(glitchAt.pace).toBe('run');
    expect(MONDAY.beats.filter(b => b.x < glitchAt.x).some(b => b.pace === 'run')).toBe(false);
    expect(MONDAY.beats.filter(b => b.x > glitchAt.x).some(b => b.pace)).toBe(false);
  });
  it('хук короткий: до пика — от двух до трёх минут чистого бега, сбой начинается в первые полминуты', () => {
    const at = (x: number) => secondsTo(MONDAY.startX, MONDAY.startPace, MONDAY.beats, x);
    expect(at(MONDAY.beats.find(b => b.glitch)!.x)).toBeLessThan(30);
    expect(at(PEAK_X)).toBeGreaterThan(90);
    expect(at(PEAK_X)).toBeLessThan(150);
  });
  it('дверь видна из кадра телефона и после названия стоит ближе, чем держалась', () => {
    expect(MONDAY.door.keepAway).toBeLessThan(640 * 0.7); // Саша на 30% ширины кадра
    expect(MONDAY.door.nearSteps).toBeLessThan(MONDAY.door.keepAway);
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

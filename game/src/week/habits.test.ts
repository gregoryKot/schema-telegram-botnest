import { describe, expect, it } from 'vitest';
import {
  RULES, agree, clockText, glitchLevel, isResting, isSitting, jumpFactor, nameGlitch, newWeekState, overwork, reachClock,
  scroll, tick,
} from './habits';

const start = () => newWeekState(11 * 60);

describe('ПЕРЕРАБОТАТЬ', () => {
  it('сбой отступает, дел больше, сил меньше', () => {
    const s = overwork(start());
    expect(s.energy).toBe(100 - RULES.overworkCost);
    expect(s.piles).toBe(RULES.overworkPiles);
    expect(glitchLevel(s, 1)).toBeLessThan(1);
    expect(glitchLevel(s, 1)).toBeGreaterThan(0); // отступил, а не погас
  });
  it('отступивший сбой возвращается', () => {
    const s = tick(overwork(start()), RULES.overworkCalmMs);
    expect(glitchLevel(s, 0.7)).toBe(0.7);
  });
  it('силы на нуле — Саша плетётся, а потом возвращает часть сил: проиграть нельзя', () => {
    let s = start();
    while (s.energy > 0) s = overwork(s);
    expect(isResting(s)).toBe(true);
    expect(isSitting(s)).toBe(true); // сначала садится
    s = tick(s, RULES.restMs - 1);
    expect(isResting(s)).toBe(true);
    s = tick(s, 1);
    expect(isResting(s)).toBe(false);
    expect(s.energy).toBe(RULES.restEnergy);
    expect(overwork(s).piles).toBeGreaterThan(s.piles); // привычка срабатывает и дальше
  });
  it('на пике цена та же, а сбой не отступает', () => {
    const s = overwork(start(), true);
    expect(s.energy).toBe(100 - RULES.overworkCost);
    expect(glitchLevel(s, 1)).toBe(1);
  });
});

describe('ПРОЛИСТАТЬ', () => {
  it('сбой гаснет, часы перескакивают, мир сереет', () => {
    const s = scroll(newWeekState(12 * 60 + 10));
    expect(clockText(s.clockMin)).toBe('14:20');
    expect(s.color).toBeLessThan(1);
    expect(glitchLevel(s, 0.7)).toBe(0);
    expect(glitchLevel(tick(s, RULES.scrollCalmMs), 0.7)).toBe(0.7);
  });
  it('часы не уходят за встречу, цвет не уходит ниже нуля', () => {
    let s = start();
    for (let i = 0; i < 6; i++) s = scroll(s);
    expect(s.clockMin).toBe(RULES.clockCap);
    expect(s.color).toBe(0);
  });
  it('на пике телефон гаснет сам — ничего не меняется', () => {
    const s = start();
    expect(scroll(s, true)).toBe(s);
  });
});

describe('СОГЛАСИТЬСЯ', () => {
  it('рюкзак тяжелеет, прыжок ниже, но не пропадает', () => {
    const one = agree(start(), true);
    expect(one.load).toBe(1);
    expect(jumpFactor(one)).toBeLessThan(jumpFactor(start()));
    let s = one;
    for (let i = 0; i < 20; i++) s = agree(s, true);
    expect(jumpFactor(s)).toBe(RULES.minJump);
  });
  it('соглашаться не с кем — ничего не происходит', () => {
    const s = start();
    expect(agree(s, false)).toBe(s);
  });
});

describe('сбой и часы', () => {
  it('названный сбой не возвращается, цвет на месте, цена остаётся', () => {
    const paid = agree(scroll(overwork(start())), true);
    const s = tick(nameGlitch(paid), 60_000);
    expect(glitchLevel(s, 1)).toBe(0);
    expect(s.color).toBe(1);
    expect(s.load).toBe(1);
    expect(s.energy).toBe(paid.energy);
  });
  it('часы идут только вперёд', () => {
    const s = reachClock(start(), 12 * 60 + 10);
    expect(clockText(s.clockMin)).toBe('12:10');
    expect(reachClock(s, 9 * 60)).toBe(s);
    expect(clockText(8 * 60 + 5)).toBe('08:05');
  });
});

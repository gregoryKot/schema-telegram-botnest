import { describe, it, expect } from 'vitest';
import { needLevel, getDayNum } from './historyMath';
import { dayValues, stripEdges } from './dayStrip';

describe('historyMath', () => {
  it('needLevel: 0 — нет подписи, 3 — низко, 6 — средне, 7 — хорошо', () => {
    expect(needLevel(0)).toBeNull();
    expect(needLevel(3)?.label).toBe('низко');
    expect(needLevel(6)?.level).toBe('warn');
    expect(needLevel(7)?.label).toBe('хорошо');
  });
  it('getDayNum убирает ведущий ноль', () => {
    expect(getDayNum('2020-01-05')).toBe('5');
  });
  // Листок дня в ленте: пять полосок по NEED_ORDER, не оценена — пустой тон (null), не ноль.
  it('dayValues раскладывает оценки по NEED_ORDER, 0 и пропуск — null', () => {
    expect(dayValues({ limits: 9, attachment: 4, play: 0 })).toEqual([4, null, null, null, 9]);
    expect(dayValues({})).toEqual([null, null, null, null, null]);
  });
  it('stripEdges: затухает только тот край, за которым есть дни', () => {
    expect(stripEdges(0, 358, 900)).toEqual({ start: false, end: true });
    expect(stripEdges(200, 358, 900)).toEqual({ start: true, end: true });
    expect(stripEdges(542, 358, 900)).toEqual({ start: true, end: false });
    expect(stripEdges(0, 358, 358)).toEqual({ start: false, end: false });
    expect(stripEdges(0.3, 358, 358.4)).toEqual({ start: false, end: false });
  });
});

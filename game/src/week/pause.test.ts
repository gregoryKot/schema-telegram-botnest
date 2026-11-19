import { describe, expect, it } from 'vitest';
import { PAUSE_HOLD_MS, choosePause, holdPause, holdProgress, newPause } from './pause';

const opened = () => holdPause(newPause(), PAUSE_HOLD_MS, true);

describe('ПАУЗА', () => {
  it('открывается только удержанием до конца', () => {
    const half = holdPause(newPause(), PAUSE_HOLD_MS / 2, true);
    expect(half.open).toBe(false);
    expect(holdProgress(half)).toBeCloseTo(0.5);
    expect(holdPause(half, PAUSE_HOLD_MS / 2, true).open).toBe(true);
  });
  it('отпустили раньше — отсчёт заново', () => {
    const released = holdPause(holdPause(newPause(), PAUSE_HOLD_MS - 1, true), 16, false);
    expect(holdProgress(released)).toBe(0);
    expect(holdPause(released, PAUSE_HOLD_MS - 1, true).open).toBe(false);
  });
  it('открытый выбор не закрывается, когда кнопку отпустили', () => {
    expect(holdPause(opened(), 500, false).open).toBe(true);
  });
  it('неверное название: выбор остаётся, сбой не назван', () => {
    const p = choosePause(choosePause(opened(), 0, 2), 0, 2);
    expect(p.open).toBe(true);
    expect(p.named).toBe(false);
    expect(p.tried).toEqual([0]);
  });
  it('верное название закрывает паузу и больше её не открыть', () => {
    const p = choosePause(choosePause(opened(), 1, 2), 2, 2);
    expect(p).toMatchObject({ open: false, named: true });
    expect(holdPause(p, PAUSE_HOLD_MS, true).open).toBe(false);
  });
  it('два шага: верный ответ первого закрывает паузу без названия, второй шаг держится заново', () => {
    const half = choosePause(choosePause(opened(), 0, 1, false), 1, 1, false);
    expect(half).toMatchObject({ open: false, named: false, step: 1, tried: [] });
    const again = holdPause(half, PAUSE_HOLD_MS, true);
    expect(again.open).toBe(true);
    expect(choosePause(again, 2, 2, true)).toMatchObject({ open: false, named: true, step: 1 });
  });
  it('без открытой паузы выбор ничего не делает', () => {
    const p = newPause();
    expect(choosePause(p, 2, 2)).toBe(p);
  });
});

describe('ПАУЗА срывается («Пятница»)', () => {
  const PLAN = [900, 2600];
  const hold = (p = newPause()) => holdPause(p, PAUSE_HOLD_MS, true, PLAN);
  it('первое удержание не открывает выбор: мир замирает и срывается сам, держат кнопку или нет', () => {
    const a = hold();
    expect(a.open).toBe(false);
    expect(a.slipMs).toBe(900);
    expect(holdPause(a, 400, false, PLAN).slipMs).toBe(500);
    const b = holdPause(holdPause(a, 400, false, PLAN), 500, true, PLAN);
    expect(b).toMatchObject({ slipMs: 0, slips: 1, open: false, tried: [], step: 0 });
  });
  it('после срыва кнопку нужно отпустить: зажатая с прошлого раза не считается', () => {
    const slipped = holdPause(hold(), 900, true, PLAN);
    expect(holdPause(slipped, PAUSE_HOLD_MS, true, PLAN).heldMs).toBe(0);
    const released = holdPause(slipped, 16, false, PLAN);
    expect(holdPause(released, PAUSE_HOLD_MS, true, PLAN).slipMs).toBe(2600);
  });
  it('вторая попытка держится дольше первой, третья открывает выбор; на втором шаге срывов нет', () => {
    let p = newPause();
    for (const ms of PLAN) {
      p = hold(p);
      expect(p.slipMs).toBe(ms);
      p = holdPause(holdPause(p, ms, false, PLAN), 16, false, PLAN);
    }
    p = hold(p);
    expect(p.open).toBe(true);
    p = choosePause(p, 1, 1, false);
    expect(hold(p).open).toBe(true);
  });
  it('без плана срывов ПАУЗА открывается с первого удержания', () => {
    expect(holdPause(newPause(), PAUSE_HOLD_MS, true).open).toBe(true);
  });
});

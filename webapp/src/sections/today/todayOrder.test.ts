import { describe, it, expect } from 'vitest';
import { TODAY_BLOCK_ORDER } from '../../../../shared/src/today/todayBlocks';
import { todayBlockOrders, todayOrderStyle } from './todayOrder';

describe('todayBlockOrders', () => {
  it('порядок по умолчанию — возрастающие order от 10 с шагом 10', () => {
    expect(todayBlockOrders(TODAY_BLOCK_ORDER)).toEqual({
      therapist_banner: 10,
      streak: 20,
      focus: 30,
      phrase: 40,
      secondary: 50,
    });
  });

  it('перестановка меняет order: фраза первой — у неё меньший order, чем у фокуса', () => {
    const orders = todayBlockOrders(['phrase', 'focus', 'streak', 'secondary', 'therapist_banner']);
    expect(orders.phrase).toBeLessThan(orders.focus);
    expect(orders.focus).toBeLessThan(orders.streak);
  });

  it('все блоки выше закреплённых сверху (разбор — 1, «С чего начать» — 2) и ниже значка (90)', () => {
    for (const order of Object.values(todayBlockOrders(TODAY_BLOCK_ORDER))) {
      expect(order).toBeGreaterThan(2);
      expect(order).toBeLessThan(90);
    }
  });
});

describe('todayOrderStyle', () => {
  it('отдаёт CSS-переменные --ct-o-<id>, по которым client-today.css расставляет блоки', () => {
    const style = todayOrderStyle(['streak', 'focus', 'phrase', 'secondary', 'therapist_banner']) as Record<string, number>;
    expect(style['--ct-o-streak']).toBe(10);
    expect(style['--ct-o-therapist_banner']).toBe(50);
    expect(Object.keys(style)).toHaveLength(5);
  });
});

import { describe, it, expect } from 'vitest';
import { fitWidth, flowRows } from './diagramFlow';

const item = (w = 100, h = 50) => ({ w, h });

describe('flowRows', () => {
  it('ряд центрируется в доступной ширине', () => {
    const r = flowRows([item(), item()], 16, 400);
    // 100 + 16 + 100 = 216; левый край = 16 + (400 - 216) / 2
    expect(r.placed[0].x).toBe(108);
    expect(r.placed[1].x).toBe(224);
    expect(r.w).toBe(216);
    expect(r.h).toBe(50);
  });

  it('не влезло — следующий ряд ниже на высоту ряда и зазор', () => {
    const r = flowRows([item(), item(), item()], 0, 250);
    expect(r.placed[2].y).toBe(66);
    expect(r.placed[2].x).toBe(75);
    expect(r.h).toBe(116);
  });

  it('maxPerRow держит ряд коротким, даже если место есть', () => {
    const r = flowRows([item(), item(), item()], 0, 1000, 2);
    expect(r.placed.map((p) => p.y)).toEqual([0, 0, 66]);
  });

  it('фигура ниже соседа стоит по центру ряда', () => {
    const r = flowRows([item(100, 80), item(100, 40)], 0, 300);
    expect(r.placed[1].y).toBe(20);
  });

  it('gapBefore заменяет обычный зазор только внутри ряда', () => {
    const r = flowRows([item(), { ...item(), gapBefore: 60 }], 0, 400);
    expect(r.placed[1].x - (r.placed[0].x + 100)).toBe(60);
    const wrapped = flowRows([item(), { ...item(), gapBefore: 60 }], 0, 150);
    expect(wrapped.placed[1].y).toBe(66);
  });

  it('пусто — нулевой размер', () => {
    expect(flowRows([], 0, 100)).toEqual({ placed: [], w: 0, h: 0 });
  });
});

describe('fitWidth', () => {
  it('две полной ширины влезают — берётся полная', () => {
    expect(fitWidth(168, 148, 352)).toBe(168);
    expect(fitWidth(168, 148, 1000)).toBe(168);
  });

  it('иначе сужается до половины ряда, но не уже минимума', () => {
    expect(fitWidth(168, 148, 326)).toBe(155);
    expect(fitWidth(168, 148, 312)).toBe(148);
  });

  it('и в минимум две не влезают — одна, не шире доступного', () => {
    expect(fitWidth(168, 148, 300)).toBe(168);
    expect(fitWidth(168, 148, 200)).toBe(168);
    expect(fitWidth(168, 148, 150)).toBe(150);
  });
});

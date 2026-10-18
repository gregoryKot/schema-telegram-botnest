// Математика drag&drop (utils/dragReorder.ts) — без React/DOM. Пороги
// (середина+середина соседа), края диапазона, нулевое смещение, неравные
// высоты строк, splice-перестановка reorderedIds.
import { describe, it, expect } from 'vitest';
import { targetIndexFromOffset, reorderedIds } from './dragReorder';

describe('targetIndexFromOffset', () => {
  const EQUAL = [56, 56, 56, 56];

  it('нулевое смещение — индекс не меняется', () => {
    expect(targetIndexFromOffset(1, 0, EQUAL, 0, 3)).toBe(1);
  });

  it('смещение ниже порога (половина+половина соседа) — остаётся на месте', () => {
    expect(targetIndexFromOffset(0, 55, EQUAL, 0, 3)).toBe(0);
  });

  it('смещение ровно на пороге — переходит к соседу', () => {
    expect(targetIndexFromOffset(0, 56, EQUAL, 0, 3)).toBe(1);
  });

  it('смещение вниз через несколько соседей — считает пороги кумулятивно', () => {
    // 0→1: 56, 1→2: 56, итого 112 ровно на порог второго перехода.
    expect(targetIndexFromOffset(0, 112, EQUAL, 0, 3)).toBe(2);
  });

  it('смещение вверх (отрицательное) — считает от старта в обратную сторону', () => {
    expect(targetIndexFromOffset(3, -56, EQUAL, 0, 3)).toBe(2);
  });

  it('диапазон [min,max] — не пускает дальше границы сегмента (группа)', () => {
    expect(targetIndexFromOffset(1, 1000, EQUAL, 0, 2)).toBe(2);
    expect(targetIndexFromOffset(1, -1000, EQUAL, 0, 2)).toBe(0);
  });

  it('startIndex вне диапазона — клэмпится внутрь [min,max] перед расчётом', () => {
    expect(targetIndexFromOffset(3, 0, EQUAL, 0, 1)).toBe(1);
  });

  it('пустой список высот — возвращает 0 без деления на ноль/бесконечного цикла', () => {
    expect(targetIndexFromOffset(0, 100, [], 0, 0)).toBe(0);
  });

  it('неравные высоты — порог считается по факту высот перетаскиваемой и соседней строки', () => {
    const heights = [40, 80, 40];
    // 0→1: 40/2 + 80/2 = 60.
    expect(targetIndexFromOffset(0, 59, heights, 0, 2)).toBe(0);
    expect(targetIndexFromOffset(0, 60, heights, 0, 2)).toBe(1);
  });

  it('неравные высоты — второй порог считает от высоты перетаскиваемой строки (не пройденного соседа)', () => {
    const heights = [40, 80, 20];
    // 0→1 порог 60, 1→2 порог: перетаскиваемая (40)/2 + 20/2 = 30 → итого 90.
    expect(targetIndexFromOffset(0, 89, heights, 0, 2)).toBe(1);
    expect(targetIndexFromOffset(0, 90, heights, 0, 2)).toBe(2);
  });
});

describe('reorderedIds', () => {
  it('fromIndex === toIndex — возвращает тот же массив (reference equality)', () => {
    const ids = ['a', 'b', 'c'];
    expect(reorderedIds(ids, 1, 1)).toBe(ids);
  });

  it('перемещение вниз сдвигает промежуточные элементы вверх', () => {
    expect(reorderedIds(['a', 'b', 'c', 'd'], 0, 2)).toEqual([
      'b',
      'c',
      'a',
      'd',
    ]);
  });

  it('перемещение вверх сдвигает промежуточные элементы вниз', () => {
    expect(reorderedIds(['a', 'b', 'c', 'd'], 3, 1)).toEqual([
      'a',
      'd',
      'b',
      'c',
    ]);
  });

  it('индексы вне диапазона клэмпятся к границам списка', () => {
    expect(reorderedIds(['a', 'b', 'c'], 0, 999)).toEqual(['b', 'c', 'a']);
    expect(reorderedIds(['a', 'b', 'c'], -5, 2)).toEqual(['b', 'c', 'a']);
  });

  it('пустой список — возвращает тот же (пустой) массив', () => {
    const ids: string[] = [];
    expect(reorderedIds(ids, 0, 0)).toBe(ids);
  });

  it('клэмп toIndex обратно к fromIndex — тоже reference equality (no-op)', () => {
    const ids = ['a', 'b', 'c'];
    // fromIndex=2 (последний), toIndex=999 клэмпится к 2 — no-op.
    expect(reorderedIds(ids, 2, 999)).toBe(ids);
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { exampleWindow, nextExampleStart, resetExampleRotation } from './exampleRotation';
import { NEED_ORDER, buildNeedData } from './needData';

const pool = Array.from({ length: 20 }, (_, i) => `п${i}`);

beforeEach(resetExampleRotation);

describe('exampleRotation', () => {
  it('окно идёт подряд и переходит через конец пула', () => {
    expect(exampleWindow(pool, 19, 2)).toEqual(['п19', 'п0']);
    expect(exampleWindow(['а'], 0, 2)).toEqual(['а']);
    expect(exampleWindow([], 0, 2)).toEqual([]);
  });

  it('следующее открытие не повторяет ни одного примера прошлого — при любой случайности', () => {
    for (const count of [2, 4]) {
      for (const r of [0, 0.3, 0.5, 0.999]) {
        resetExampleRotation();
        let prev = exampleWindow(pool, nextExampleStart('k', pool.length, count, () => r), count);
        for (let i = 0; i < 50; i++) {
          const cur = exampleWindow(pool, nextExampleStart('k', pool.length, count, () => (r + i * 0.37) % 1), count);
          expect(cur.filter((x) => prev.includes(x))).toEqual([]);
          prev = cur;
        }
      }
    }
  });

  it('у каждой потребности своя память', () => {
    const a = nextExampleStart('a', 20, 2, () => 0);
    expect(nextExampleStart('b', 20, 2, () => 0)).toBe(a);
  });

  it('маленький пул не ломается: окно сдвигается, индекс в границах', () => {
    const first = nextExampleStart('s', 3, 2, () => 0);
    const second = nextExampleStart('s', 3, 2, () => 0);
    expect(second).not.toBe(first);
    expect(second).toBeLessThan(3);
    expect(nextExampleStart('e', 0, 2)).toBe(0);
  });

  it('пул примеров каждой потребности большой, без повторов и в обеих формах обращения', () => {
    const data = buildNeedData((ty, vy) => `${ty}|${vy}`);
    for (const id of NEED_ORDER) {
      const { examples } = data[id];
      expect(examples.length).toBeGreaterThanOrEqual(20);
      expect(new Set(examples).size).toBe(examples.length);
      for (const ex of examples) {
        const vy = ex.includes('|') ? ex.split('|')[1] : ex;
        expect(vy.replace(/«[^»]*»/g, '')).not.toMatch(/(^|[^а-яё])(ты|тебя|тебе|тобой|твой|твоя|твоё|твои)([^а-яё]|$)/i);
      }
    }
  });
});

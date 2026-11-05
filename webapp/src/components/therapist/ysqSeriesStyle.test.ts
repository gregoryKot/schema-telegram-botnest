// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { seriesDashes, labelIndexes, DASHES } from './ysqSeriesStyle';

describe('seriesDashes', () => {
  it('схемы одного домена получают разный штрих, первая — сплошная', () => {
    const dom: Record<string, string> = { a: 'x', b: 'x', c: 'x', d: 'y', e: 'y' };
    const out = seriesDashes(['a', 'b', 'c', 'd', 'e'], (id) => dom[id]);
    expect(out.a).toBe('');
    expect(new Set([out.a, out.b, out.c]).size).toBe(3);
    expect(out.d).toBe('');
    expect(out.e).toBe(DASHES[1]);
  });

  it('схема без домена не ломает счёт', () => {
    const out = seriesDashes(['p', 'q'], () => undefined);
    expect(out).toEqual({ p: '', q: '' });
  });
});

describe('labelIndexes', () => {
  it('влезает — все подписи', () => {
    expect(labelIndexes(3, 4)).toEqual([0, 1, 2]);
  });
  it('не влезает — первая и последняя остаются, подписей не больше max', () => {
    const idx = labelIndexes(10, 4);
    expect(idx[0]).toBe(0);
    expect(idx.at(-1)).toBe(9);
    expect(idx.length).toBeLessThanOrEqual(4);
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import { isWeekDone, markWeekDone } from './progress';

const mem = new Map<string, string>();
beforeEach(() => {
  mem.clear();
  globalThis.localStorage = {
    getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v); },
  } as Storage;
});

describe('прогресс «Недели»', () => {
  it('пройденный день находится заставкой, другой — нет', () => {
    expect(isWeekDone('mon')).toBe(false);
    markWeekDone('mon');
    markWeekDone('mon');
    expect(isWeekDone('mon')).toBe(true);
    expect(isWeekDone('wed')).toBe(false);
    expect(JSON.parse(mem.get('week_done')!)).toEqual(['mon']);
  });
  it('битая запись не роняет игру', () => {
    mem.set('week_done', '{');
    expect(isWeekDone('mon')).toBe(false);
  });
});

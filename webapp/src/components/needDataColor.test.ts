import { describe, expect, it } from 'vitest';
import { NEED_ORDER } from '../../../shared/src/needs/types';
import { NEED_DATA_PAPER } from './art/paper';
import { needDataColor, needDataStyle } from './needDataColor';

describe('needDataColor', () => {
  it('цвет потребности — по её месту в NEED_ORDER, а не по порядку на экране', () => {
    expect(NEED_ORDER.map(needDataColor)).toEqual([...NEED_DATA_PAPER]);
    expect(needDataColor('limits')).toBe('var(--c-moss)');
    expect(needDataColor('autonomy')).toBe('var(--c-amber-strong)');
  });

  it('у каждой из пяти свой цвет', () => {
    expect(new Set(NEED_ORDER.map(needDataColor)).size).toBe(NEED_ORDER.length);
  });

  it('неизвестная потребность — без цвета, и style пустой', () => {
    expect(needDataColor('mood')).toBeUndefined();
    expect(needDataStyle('mood')).toEqual({});
    expect(needDataStyle(undefined)).toEqual({});
  });

  it('style кладёт цвет в --nd', () => {
    expect(needDataStyle('play')).toEqual({ '--nd': 'var(--c-plum)' });
  });
});

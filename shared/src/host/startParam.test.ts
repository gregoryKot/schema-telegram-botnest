import { describe, it, expect } from 'vitest';
import { parseStartParam } from './startParam';

describe('parseStartParam', () => {
  it('pair_/therapy_ дают присоединение с кодом', () => {
    expect(parseStartParam('pair_AB12')).toEqual({
      kind: 'join',
      joinKind: 'pair',
      code: 'AB12',
    });
    expect(parseStartParam('therapy_XY')).toEqual({
      kind: 'join',
      joinKind: 'therapy',
      code: 'XY',
    });
  });
  it('префикс без кода игнорируется', () => {
    expect(parseStartParam('pair_')).toBeNull();
    expect(parseStartParam('therapy_')).toBeNull();
  });
  it('diaries и tracker', () => {
    expect(parseStartParam('diaries')).toEqual({ kind: 'diaries' });
    expect(parseStartParam('tracker')).toEqual({ kind: 'tracker' });
  });
  it('неизвестное, пустое и null игнорируются', () => {
    expect(parseStartParam('settings')).toBeNull();
    expect(parseStartParam('diariesX')).toBeNull();
    expect(parseStartParam('')).toBeNull();
    expect(parseStartParam(null)).toBeNull();
    expect(parseStartParam(undefined)).toBeNull();
  });
});

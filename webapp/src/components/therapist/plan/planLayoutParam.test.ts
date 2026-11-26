import { describe, it, expect } from 'vitest';
import { layoutFromSearch, planPhasesPath } from './planLayoutParam';

describe('planLayoutParam', () => {
  it('читает раскладку из адреса', () => {
    expect(layoutFromSearch('?layout=phases')).toBe('phases');
    expect(layoutFromSearch('?a=1&layout=channels')).toBe('channels');
  });
  it('нет параметра или мусор — null', () => {
    expect(layoutFromSearch('')).toBeNull();
    expect(layoutFromSearch('?layout=zzz')).toBeNull();
  });
  it('адрес «пути» ведёт на план по фазам', () => {
    expect(planPhasesPath('abcdefgh')).toBe('/cabinet/abcdefgh/plan?layout=phases');
    expect(layoutFromSearch(planPhasesPath('x').split('?')[1] ? '?' + planPhasesPath('x').split('?')[1] : '')).toBe('phases');
  });
});

import { describe, it, expect } from 'vitest';
import { isCompactHead } from './useClientHead';

describe('isCompactHead — компактная шапка карточки клиента', () => {
  it('включается только на вкладке «Графические карты»', () => {
    expect(isCompactHead('mode_map', false)).toBe(true);
    for (const tab of ['overview', 'concept', 'sessions', 'tasks', 'ysq', 'diary']) expect(isCompactHead(tab, false), tab).toBe(false);
  });
  it('на телефоне холста нет — шапка обычная и на «Графических картах»', () => {
    expect(isCompactHead('mode_map', true)).toBe(false);
  });
});

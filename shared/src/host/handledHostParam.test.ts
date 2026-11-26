// @vitest-environment jsdom
// Память о разобранном start_param хоста (#758): перезагрузка вебвью Telegram
// отдаёт тот же параметр, и согласие на пару открывалось второй раз.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { freshHostParam, HANDLED_HOST_PARAM_KEY } from './handledHostParam';

beforeEach(() => sessionStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('freshHostParam', () => {
  it('первый раз отдаёт параметр, второй раз в той же вкладке — null', () => {
    expect(freshHostParam('pair_AB12')).toBe('pair_AB12');
    expect(sessionStorage.getItem(HANDLED_HOST_PARAM_KEY)).toBe('pair_AB12');
    expect(freshHostParam('pair_AB12')).toBeNull();
  });

  it('другой параметр — снова свежий', () => {
    freshHostParam('pair_AB12');
    expect(freshHostParam('therapy_XY')).toBe('therapy_XY');
  });

  it('параметра нет — null, память не трогается', () => {
    expect(freshHostParam(null)).toBeNull();
    expect(sessionStorage.getItem(HANDLED_HOST_PARAM_KEY)).toBeNull();
  });

  it('хранилище закрыто — параметр отдаётся как есть (ссылку не теряем)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(freshHostParam('pair_AB12')).toBe('pair_AB12');
  });
});

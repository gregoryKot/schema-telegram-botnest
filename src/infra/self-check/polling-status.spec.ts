import { pollingStatus } from './polling-status';

beforeEach(() => pollingStatus.reset(1_000));

describe('pollingStatus', () => {
  it('стартует в idle', () => {
    expect(pollingStatus.get()).toEqual({
      state: 'idle',
      since: 1_000,
      lastError: null,
    });
  });

  it('since двигается только при смене состояния, а не при повторной записи', () => {
    pollingStatus.set('starting', null, 2_000);
    pollingStatus.set('failed', 'ETIMEDOUT', 3_000);
    pollingStatus.set('failed', 'ETIMEDOUT', 9_000); // ещё одна неудача подряд
    expect(pollingStatus.get().since).toBe(3_000);
  });

  it('ошибка живёт, пока состояние failed, и стирается при running', () => {
    pollingStatus.set('failed', '409', 2_000);
    pollingStatus.set('failed', null, 3_000);
    expect(pollingStatus.get().lastError).toBe('409');
    pollingStatus.set('running', null, 4_000);
    expect(pollingStatus.get().lastError).toBeNull();
  });
});

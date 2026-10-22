import { DEPLOY_TARGETS, isVpsTarget } from './deploy-target';

describe('isVpsTarget', () => {
  it.each([
    [{ DEPLOY_TARGET: 'vps' }, true],
    [{ DEPLOY_TARGET: ' vps ' }, true],
    [{ DEPLOY_TARGET: 'amvera' }, false],
    [{ DEPLOY_TARGET: '' }, false],
    [{ DEPLOY_TARGET: 'VPS' }, false],
    [{}, false],
  ])('%j → %s', (env, expected) => {
    expect(isVpsTarget(env)).toBe(expected);
  });

  it('читает process.env по умолчанию', () => {
    const prev = process.env.DEPLOY_TARGET;
    process.env.DEPLOY_TARGET = 'vps';
    try {
      expect(isVpsTarget()).toBe(true);
    } finally {
      if (prev === undefined) delete process.env.DEPLOY_TARGET;
      else process.env.DEPLOY_TARGET = prev;
    }
  });

  it('список площадок содержит vps (на него опирается реестр и проверка env)', () => {
    expect(DEPLOY_TARGETS).toContain('vps');
  });
});

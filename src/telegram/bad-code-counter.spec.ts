// Счётчик негодных кодов. Вынесен из telegram.login.service.ts — тесты про
// саму механику переехали сюда вместе с ней.
import {
  BadCodeCounter,
  MAX_BAD_CODES,
  BAD_CODE_WINDOW_MS,
} from './bad-code-counter';

describe('BadCodeCounter', () => {
  it('до лимита молчать не пора', () => {
    const c = new BadCodeCounter(() => undefined);
    for (let i = 0; i < MAX_BAD_CODES - 1; i++) {
      c.note(1);
      expect(c.tooMany(1)).toBe(false);
    }
  });

  it('ровно на лимите пора замолчать', () => {
    const c = new BadCodeCounter(() => undefined);
    for (let i = 0; i < MAX_BAD_CODES; i++) c.note(1);
    expect(c.tooMany(1)).toBe(true);
  });

  it('onLimit зовётся ровно один раз — на пятом промахе, а не на каждом', () => {
    const onLimit = jest.fn();
    const c = new BadCodeCounter(onLimit);
    for (let i = 0; i < MAX_BAD_CODES + 3; i++) c.note(7);
    expect(onLimit).toHaveBeenCalledTimes(1);
    expect(onLimit).toHaveBeenCalledWith(7);
  });

  it('счёт ведётся по людям отдельно', () => {
    const c = new BadCodeCounter(() => undefined);
    for (let i = 0; i < MAX_BAD_CODES; i++) c.note(1);
    expect(c.tooMany(1)).toBe(true);
    expect(c.tooMany(2)).toBe(false);
  });

  it('после окна счёт начинается заново', () => {
    let now = 1_000_000;
    const c = new BadCodeCounter(
      () => undefined,
      () => now,
    );
    for (let i = 0; i < MAX_BAD_CODES; i++) c.note(1);
    expect(c.tooMany(1)).toBe(true);
    now += BAD_CODE_WINDOW_MS + 1;
    expect(c.tooMany(1)).toBe(false);
    c.note(1);
    expect(c.tooMany(1)).toBe(false);
  });

  it('карта не растёт бесконечно: протухшие записи выметаются', () => {
    let now = 1_000_000;
    const c = new BadCodeCounter(
      () => undefined,
      () => now,
    );
    // Каждый «человек» промахивается один раз, потом окно истекает — старые
    // записи обязаны уйти, а не копиться до перезапуска процесса.
    for (let id = 1; id <= 1100; id++) {
      c.note(id);
      if (id === 1050) now += BAD_CODE_WINDOW_MS + 1;
    }
    const size = (c as unknown as { seen: Map<number, unknown> }).seen.size;
    expect(size).toBeLessThan(1100);
    expect(size).toBeGreaterThan(0);
  });
});

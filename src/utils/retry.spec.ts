// Регрессия на инцидент 2026-07-12: setMyCommands упал на старте свежего
// контейнера (сеть поднялась позже процесса) и разбудил админа 🚨-алертом,
// хотя вызов декоративный. Теперь — retryWithBackoff + warn.
import { retryWithBackoff } from './retry';

describe('retryWithBackoff', () => {
  it('успех с первой попытки — true, один вызов', async () => {
    const fn = jest.fn(async () => 'ok');
    await expect(retryWithBackoff(fn, { baseDelayMs: 1 })).resolves.toBe(true);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('транзиентный сбой — ретраит и возвращает true', async () => {
    let calls = 0;
    const fn = jest.fn(async () => {
      if (++calls < 3) throw new Error('ECONNRESET');
    });
    await expect(
      retryWithBackoff(fn, { attempts: 3, baseDelayMs: 1 }),
    ).resolves.toBe(true);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('все попытки исчерпаны — false, не бросает', async () => {
    const fn = jest.fn(async () => {
      throw new Error('down');
    });
    await expect(
      retryWithBackoff(fn, { attempts: 2, baseDelayMs: 1 }),
    ).resolves.toBe(false);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

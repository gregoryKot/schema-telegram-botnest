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

  // Ретраи старта не держат процесс после app.close(): e2e не выходили сразу
  // после тестов (2026-11-08) — таймер бэкоффа ждал своих 5 с.
  describe('signal', () => {
    afterEach(() => jest.useRealTimers());

    it('abort посреди паузы — сразу false, таймер снят, новых попыток нет', async () => {
      jest.useFakeTimers();
      const ctl = new AbortController();
      const fn = jest.fn(async () => {
        throw new Error('down');
      });
      const done = retryWithBackoff(fn, { signal: ctl.signal });
      await jest.advanceTimersByTimeAsync(0);
      expect(fn).toHaveBeenCalledTimes(1);
      expect(jest.getTimerCount()).toBe(1); // ждёт 5 с до второй попытки
      ctl.abort();
      await expect(done).resolves.toBe(false);
      expect(jest.getTimerCount()).toBe(0);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('уже оборванный signal — ни одной попытки', async () => {
      const ctl = new AbortController();
      ctl.abort();
      const fn = jest.fn(async () => 'ok');
      await expect(retryWithBackoff(fn, { signal: ctl.signal })).resolves.toBe(
        false,
      );
      expect(fn).not.toHaveBeenCalled();
    });

    it('контроль: без abort пауза доживает до следующей попытки и успеха', async () => {
      jest.useFakeTimers();
      const ctl = new AbortController();
      let calls = 0;
      const fn = jest.fn(async () => {
        if (++calls < 2) throw new Error('ECONNRESET');
      });
      const done = retryWithBackoff(fn, { signal: ctl.signal });
      await jest.advanceTimersByTimeAsync(5_000);
      await expect(done).resolves.toBe(true);
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });
});

// Регрессии запуска long-polling.
//
// 2026-07-16: транзиентный ETIMEDOUT на getMe реджектил launch() — без ретрая
// поллинг не стартовал вовсе.
// Аудит 2026-10, backend#12: 409 («terminated by other getUpdates request»)
// глотался голым return — поллинг умирал навсегда при зелёных getMe и /health,
// а прежний спек пинил «ровно одна попытка». Теперь 409 ретраится, шумит и
// виден в состоянии (pollingStatus → проба telegramPolling).
// Шов с настоящим Telegraf — telegram.polling.seam.spec.ts; здесь логика
// ретрая и счёт алертов на подменённом launch().
import { Logger } from '@nestjs/common';
import { pollingStatus } from '../infra/self-check/polling-status';
import {
  BotLauncher,
  ERROR_AFTER_FAILURES,
  ERROR_REPEAT_EVERY,
  RETRY_DELAYS_MS,
  isPollingConflict,
  retryDelayMs,
  shouldAlert,
} from './telegram.launch';

// Успех = поллинг стартовал: launch() резолвится лишь при остановке, поэтому
// «успешный» промис не сеттлится в рамках теста.
const PENDING = () => new Promise<void>(() => {});
const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};
const conflict = () =>
  Object.assign(new Error('409: Conflict: terminated by other getUpdates'), {
    code: 409,
  });

function makeLauncher(launch: jest.Mock) {
  const logger = new Logger('test');
  return new BotLauncher({ launch } as never, logger);
}

describe('BotLauncher', () => {
  let warn: jest.SpyInstance;
  let error: jest.SpyInstance;
  beforeEach(() => {
    jest.useFakeTimers();
    pollingStatus.reset();
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    error = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  /** Прокручивает n неудачных попыток подряд, соблюдая паузы бэкоффа. */
  async function failTimes(n: number) {
    for (let i = 1; i < n; i++) {
      await flush();
      jest.advanceTimersByTime(retryDelayMs(i));
    }
    await flush();
  }

  it('запускает без стирания очереди: dropPendingUpdates: false', () => {
    const launch = jest.fn(PENDING);
    makeLauncher(launch).start();
    expect(launch).toHaveBeenCalledWith({ dropPendingUpdates: false });
    expect(pollingStatus.get().state).toBe('starting');
  });

  it('транзиентный ETIMEDOUT ретраится через 5 с, поллинг в итоге стартует', async () => {
    const launch = jest
      .fn()
      .mockRejectedValueOnce(new Error('request to .../getMe failed ETIMEDOUT'))
      .mockImplementationOnce(PENDING);
    makeLauncher(launch).start();

    await flush();
    expect(launch).toHaveBeenCalledTimes(1);
    expect(pollingStatus.get().state).toBe('failed');
    jest.advanceTimersByTime(4_999);
    expect(launch).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(1);
    expect(launch).toHaveBeenCalledTimes(2);
  });

  it('409 ретраится с бэкоффом 5 с, 15 с, 60 с, дальше раз в минуту', async () => {
    const launch = jest.fn().mockRejectedValue(conflict());
    makeLauncher(launch).start();

    const pauses = [5_000, 15_000, 60_000, 60_000, 60_000];
    let expected = 1;
    for (const pause of pauses) {
      await flush();
      expect(launch).toHaveBeenCalledTimes(expected);
      jest.advanceTimersByTime(pause - 1);
      expect(launch).toHaveBeenCalledTimes(expected);
      jest.advanceTimersByTime(1);
      expected += 1;
      expect(launch).toHaveBeenCalledTimes(expected);
    }
    expect(RETRY_DELAYS_MS).toEqual([5_000, 15_000, 60_000]);
  });

  it('каждая неудача — warn, error только с 5-й подряд (уходит владельцу)', async () => {
    const launch = jest.fn().mockRejectedValue(conflict());
    makeLauncher(launch).start();

    await failTimes(ERROR_AFTER_FAILURES - 1);
    expect(warn).toHaveBeenCalledTimes(ERROR_AFTER_FAILURES - 1);
    expect(error).not.toHaveBeenCalled();

    jest.advanceTimersByTime(60_000);
    await flush();
    expect(error).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('409'),
      expect.any(Error),
    );
    expect(pollingStatus.get().lastError).toContain('409');
  });

  it('не сдаётся: после 5-й неудачи попытки продолжаются', async () => {
    const launch = jest.fn().mockRejectedValue(new Error('ETIMEDOUT'));
    makeLauncher(launch).start();
    await failTimes(8);
    expect(launch).toHaveBeenCalledTimes(8);
  });

  it('error не чаще раза в ERROR_REPEAT_EVERY неудач (не заливаем DM)', () => {
    const alerts = Array.from({ length: 60 }, (_, i) => i + 1).filter(
      shouldAlert,
    );
    expect(alerts).toEqual([
      ERROR_AFTER_FAILURES,
      ERROR_AFTER_FAILURES + ERROR_REPEAT_EVERY,
      ERROR_AFTER_FAILURES + 2 * ERROR_REPEAT_EVERY,
      ERROR_AFTER_FAILURES + 3 * ERROR_REPEAT_EVERY,
    ]);
  });

  it('штатная остановка — ретрай не планируется и не шумит', async () => {
    const launch = jest.fn().mockRejectedValue(new Error('ETIMEDOUT'));
    const launcher = makeLauncher(launch);
    launcher.start();
    await flush();
    launcher.stop();
    jest.advanceTimersByTime(120_000);
    await flush();

    expect(launch).toHaveBeenCalledTimes(1);
    expect(pollingStatus.get().state).toBe('stopped');
  });

  it('отказ после stop() (bot.stop() рвёт getUpdates) не считается сбоем', async () => {
    let reject!: (e: Error) => void;
    const launch = jest.fn(
      () => new Promise<void>((_, r) => (reject = r as (e: Error) => void)),
    );
    const launcher = makeLauncher(launch);
    launcher.start();
    launcher.stop();
    reject(new Error('AbortError'));
    await flush();
    jest.advanceTimersByTime(120_000);

    expect(launch).toHaveBeenCalledTimes(1);
    expect(warn).not.toHaveBeenCalled();
    expect(pollingStatus.get().state).toBe('stopped');
  });

  it('launch() резолвится сам по себе — состояние failed, а не тишина', async () => {
    makeLauncher(jest.fn().mockResolvedValue(undefined)).start();
    await flush();
    expect(pollingStatus.get().state).toBe('failed');
    expect(warn).toHaveBeenCalled();
  });

  it('launch() бросает синхронно — тоже ретрай, а не необработанное исключение', async () => {
    const launch = jest
      .fn()
      .mockImplementationOnce(() => {
        throw new Error('sync boom');
      })
      .mockImplementationOnce(PENDING);
    makeLauncher(launch).start();
    jest.advanceTimersByTime(5_000);
    expect(launch).toHaveBeenCalledTimes(2);
  });

  it('первый getUpdates после ретрая переводит состояние в running и обнуляет счётчик', async () => {
    const callApi = jest.fn().mockResolvedValue([]);
    const bot = {
      launch: jest.fn().mockRejectedValue(conflict()),
      telegram: { callApi },
    };
    const launcher = new BotLauncher(bot as never, new Logger('t'));
    launcher.start();
    await flush();
    expect(pollingStatus.get().state).toBe('failed');

    await bot.telegram.callApi('getMe', {});
    expect(pollingStatus.get().state).toBe('failed');
    await bot.telegram.callApi('getUpdates', {});
    expect(pollingStatus.get().state).toBe('running');
    expect(pollingStatus.get().lastError).toBeNull();
    expect(callApi).toHaveBeenCalledTimes(2);
  });
});

describe('isPollingConflict', () => {
  it.each([
    [Object.assign(new Error('x'), { code: 409 }), true],
    [new Error('409: Conflict: terminated by other getUpdates request'), true],
    [new Error('ETIMEDOUT'), false],
    [Object.assign(new Error('Unauthorized'), { code: 401 }), false],
  ])('%s → %s', (err, expected) => {
    expect(isPollingConflict(err)).toBe(expected);
  });
});

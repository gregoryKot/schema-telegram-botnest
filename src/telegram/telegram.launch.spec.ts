// Регрессия инцидента 2026-07-16: `bot.launch()` дёргает getMe(); транзиентный
// ETIMEDOUT на старте контейнера реджектил launch(), и БЕЗ ретрая поллинг не
// стартовал — бот «живой», но команды не отвечают до рестарта. Проверяем, что
// launchBotWithRetry ретраит транзиентный сбой, не ретраит 409/остановку и
// сдаётся после лимита попыток.
import { Logger } from '@nestjs/common';
import { TelegramService } from './telegram.service';

// Успех = поллинг стартовал: launch() резолвится лишь при остановке, поэтому
// «успешный» промис не сеттлится в рамках теста.
const PENDING = () => new Promise<void>(() => {});
const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

function makeService(launch: jest.Mock) {
  const bot: any = { launch };
  const service = new TelegramService(
    bot,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );
  return service;
}

describe('launchBotWithRetry', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('транзиентный ETIMEDOUT ретраится и поллинг в итоге стартует', async () => {
    const launch = jest
      .fn()
      .mockRejectedValueOnce(new Error('request to .../getMe failed ETIMEDOUT'))
      .mockImplementationOnce(PENDING);
    const service = makeService(launch);

    (service as any).launchBotWithRetry();
    expect(launch).toHaveBeenCalledTimes(1);

    await flush();
    jest.advanceTimersByTime(5_000);
    await flush();

    expect(launch).toHaveBeenCalledTimes(2);
  });

  it('409 (другой инстанс поллит) — не ретраим', async () => {
    const launch = jest
      .fn()
      .mockRejectedValue(
        new Error('409: Conflict: terminated by other getUpdates'),
      );
    const service = makeService(launch);

    (service as any).launchBotWithRetry();
    await flush();
    jest.advanceTimersByTime(60_000);
    await flush();

    expect(launch).toHaveBeenCalledTimes(1);
  });

  it('штатная остановка — ретрай не планируется', async () => {
    const launch = jest.fn().mockRejectedValue(new Error('ETIMEDOUT'));
    const service = makeService(launch);
    (service as any).stopping = true;

    (service as any).launchBotWithRetry();
    await flush();
    jest.advanceTimersByTime(60_000);
    await flush();

    expect(launch).toHaveBeenCalledTimes(1);
  });

  it('постоянный сбой — сдаёмся после 5 попыток и логируем error', async () => {
    const launch = jest.fn().mockRejectedValue(new Error('ETIMEDOUT'));
    const errorSpy = jest.spyOn(Logger.prototype, 'error');
    const service = makeService(launch);

    (service as any).launchBotWithRetry();
    // Бэкофф линейный: 5s, 10s, 15s, 20s между попытками 1→2→3→4→5.
    for (const delay of [5_000, 10_000, 15_000, 20_000]) {
      await flush();
      jest.advanceTimersByTime(delay);
    }
    await flush();

    expect(launch).toHaveBeenCalledTimes(5);
    expect(errorSpy).toHaveBeenCalled();
  });
});

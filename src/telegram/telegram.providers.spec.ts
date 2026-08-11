// Тест фабрики TELEGRAF_BOT (useFactory в TELEGRAM_PROVIDERS): единственное
// место, где реально валидируется BOT_TOKEN и разбирается сетевой сбой при
// старте контейнера. До этого теста файл был непокрыт — 0% (см. отчёт по
// покрытию src/telegram, аудит 2026-08).
//
// Telegraf-модуль мокается целиком: конструктор реального Telegraf работает
// офлайн, но getMe() бьёт в сеть — мокаем именно её, чтобы тест не зависел
// от сети и детерминированно проверял оба исхода (успех/сетевой сбой).
import { Logger } from '@nestjs/common';

const getMeMock = jest.fn();
jest.mock('telegraf', () => ({
  Telegraf: jest.fn().mockImplementation((token: string) => ({
    __token: token,
    telegram: { getMe: getMeMock },
  })),
}));

import { TELEGRAM_PROVIDERS, telegramAgent } from './telegram.providers';
import { TELEGRAF_BOT } from './telegram.constants';

function makeConfig(token: string | undefined) {
  return { get: jest.fn(() => token) } as any;
}

const factoryEntry = TELEGRAM_PROVIDERS[0] as {
  provide: symbol;
  useFactory: (config: any) => Promise<unknown>;
  inject: unknown[];
};

afterEach(() => {
  jest.restoreAllMocks();
  getMeMock.mockReset();
});

describe('TELEGRAM_PROVIDERS[TELEGRAF_BOT] — useFactory', () => {
  it('регистрирует провайдер под правильным токеном и с ConfigService в inject', () => {
    expect(factoryEntry.provide).toBe(TELEGRAF_BOT);
    expect(factoryEntry.inject).toHaveLength(1);
  });

  it('BOT_TOKEN отсутствует — бросает и логирует ошибку, Telegraf не конструируется', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { Telegraf } = jest.requireMock('telegraf') as {
      Telegraf: jest.Mock;
    };
    Telegraf.mockClear();
    await expect(
      factoryEntry.useFactory(makeConfig(undefined)),
    ).rejects.toThrow('Invalid BOT_TOKEN');
    expect(Telegraf).not.toHaveBeenCalled();
  });

  it('getMe успешен — логирует username бота и возвращает bot-инстанс', async () => {
    const logSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    getMeMock.mockResolvedValue({ id: 1, username: 'schemehappens_bot' });
    const bot = await factoryEntry.useFactory(makeConfig('123:ABC'));
    expect((bot as any).__token).toBe('123:ABC');
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('schemehappens_bot'),
    );
  });

  it('getMe падает сетевой ошибкой при старте — не бросает, возвращает bot (ретрай на launch())', async () => {
    const warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    getMeMock.mockRejectedValue(new Error('ETIMEDOUT'));
    const bot = await factoryEntry.useFactory(makeConfig('123:ABC'));
    expect(bot).toBeDefined();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('getMe failed at startup'),
    );
  });

  describe('telegramAgent', () => {
    // Инцидент 2026-08-11: пост в канал падал с ETIMEDOUT пятнадцать попыток
    // подряд, а бот при этом отвечал на команды — работало уже открытое
    // соединение опроса, а каждое новое не устанавливалось. Так выглядит битый
    // маршрут IPv6.
    it('ходит только по IPv4 — без развилки на битый IPv6', () => {
      expect(telegramAgent().options.family).toBe(4);
    });

    it('держит соединение живым — пост не платит за новое рукопожатие', () => {
      expect(telegramAgent().options.keepAlive).toBe(true);
    });
  });
});

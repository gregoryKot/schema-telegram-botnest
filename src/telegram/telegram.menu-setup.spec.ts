// Декоративные вызовы старта (меню команд, кнопка кабинета): ретраи с
// бэкоффом, warn вместо error (инцидент 2026-07-12) и обрыв по signal — таймер
// бэкоффа не держит процесс после app.close() (e2e не выходили сразу после
// тестов, 2026-11-08).
import { Logger } from '@nestjs/common';
import { setupBotMenu } from './telegram.menu-setup';
import { makeFakeBot } from './telegram.test-helpers.spec';
import { CABINET_URL } from './telegram.constants';

function setup(fail: boolean) {
  const { bot, telegram } = makeFakeBot();
  if (fail) {
    telegram.setMyCommands.mockRejectedValue(new Error('ETIMEDOUT'));
    telegram.callApi.mockRejectedValue(new Error('ETIMEDOUT'));
  }
  const logger = { warn: jest.fn() } as unknown as Logger;
  const ctl = new AbortController();
  setupBotMenu(bot, logger, ctl.signal);
  return { telegram, logger, ctl };
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('setupBotMenu', () => {
  it('ставит меню команд и кнопку кабинета', async () => {
    const { telegram, logger } = setup(false);
    await jest.advanceTimersByTimeAsync(0);
    expect(telegram.setMyCommands).toHaveBeenCalledTimes(1);
    expect(telegram.callApi).toHaveBeenCalledWith('setChatMenuButton', {
      menu_button: {
        type: 'web_app',
        text: 'Всё по схеме',
        web_app: { url: CABINET_URL },
      },
    });
    expect(logger.warn).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('Telegram не отвечает — три попытки, затем warn (не error)', async () => {
    const { telegram, logger } = setup(true);
    await jest.advanceTimersByTimeAsync(15_000);
    expect(telegram.setMyCommands).toHaveBeenCalledTimes(3);
    expect(logger.warn).toHaveBeenCalledWith(
      'setMyCommands failed after retries',
    );
    expect(logger.warn).toHaveBeenCalledWith(
      'setChatMenuButton failed after retries',
    );
  });

  it('остановка посреди бэкоффа — таймеров не остаётся, новых попыток и warn нет', async () => {
    const { telegram, logger, ctl } = setup(true);
    await jest.advanceTimersByTimeAsync(0);
    expect(jest.getTimerCount()).toBe(2); // оба ждут 5 с до второй попытки
    ctl.abort();
    await jest.advanceTimersByTimeAsync(0);
    expect(jest.getTimerCount()).toBe(0);
    await jest.advanceTimersByTimeAsync(20_000);
    expect(telegram.setMyCommands).toHaveBeenCalledTimes(1);
    expect(logger.warn).not.toHaveBeenCalled();
  });
});

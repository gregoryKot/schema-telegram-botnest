// Продолжение telegram.notify-actions.service.spec.ts: catch-блоки, которых
// не было в исходном файле (addr, notify:pause, notify:pause:cancel,
// notify:slower, notify:skip) — см. отчёт покрытия src/telegram (аудит
// 2026-08). notify:pause:7 catch уже покрыт в исходном файле.
import { Logger } from '@nestjs/common';
import { TelegramNotifyActionsService } from './telegram.notify-actions.service';
import { ERROR_RETRY } from './telegram.constants';
import { makeFakeBot, runAction } from './telegram.test-helpers.spec';

function makeService(
  botService: any,
  cadenceOverrides: Record<string, any> = {},
) {
  const cadenceService = {
    pause: jest.fn().mockResolvedValue(new Date()),
    slower: jest.fn().mockResolvedValue(1),
    skipToday: jest.fn().mockResolvedValue(undefined),
    ...cadenceOverrides,
  };
  const fakeBot = makeFakeBot();
  const service = new TelegramNotifyActionsService(
    fakeBot.bot,
    botService,
    cadenceService as any,
  );
  return { service, fakeBot, cadenceService };
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('TelegramNotifyActionsService — catch-блоки', () => {
  it('addr:ty: падение записи формы — сообщение об ошибке, ошибка залогирована', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const botService = {
      updateUserSettings: jest.fn().mockRejectedValue(new Error('db down')),
    };
    const { service, fakeBot } = makeService(botService);
    service.onModuleInit();
    const ctx = await runAction(fakeBot, 'addr:ty');
    expect(ctx.answerCbQuery).toHaveBeenCalledTimes(1);
    expect(ctx.reply).toHaveBeenCalledWith(ERROR_RETRY);
  });

  it('notify:pause: editMessageReplyMarkup падает — сообщение об ошибке', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { service, fakeBot } = makeService({});
    service.onModuleInit();
    const ctx = await runAction(fakeBot, 'notify:pause', {
      editMessageReplyMarkup: jest.fn().mockRejectedValue(new Error('too old')),
    });
    expect(ctx.answerCbQuery).toHaveBeenCalledTimes(1);
    expect(ctx.reply).toHaveBeenCalledWith(ERROR_RETRY);
  });

  it('notify:pause:cancel: answerCbQuery сам падает — человек получает исход, не бросает наружу', async () => {
    const logged = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const { service, fakeBot } = makeService({});
    service.onModuleInit();
    const ctx = await runAction(fakeBot, 'notify:pause:cancel', {
      answerCbQuery: jest.fn().mockRejectedValue(new Error('expired query')),
    });
    // Раньше catch только писал в лог: человек не видел ничего (аудит 2026-10).
    expect(ctx.reply).toHaveBeenCalledWith(ERROR_RETRY);
    expect(logged).toHaveBeenCalled();
  });

  it('notify:slower: cadenceService.slower падает — сообщение об ошибке', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const botService = { getUserSettings: jest.fn().mockResolvedValue(null) };
    const { service, fakeBot } = makeService(botService, {
      slower: jest.fn().mockRejectedValue(new Error('db down')),
    });
    service.onModuleInit();
    const ctx = await runAction(fakeBot, 'notify:slower');
    expect(ctx.answerCbQuery).toHaveBeenCalledTimes(1);
    expect(ctx.reply).toHaveBeenCalledWith(ERROR_RETRY);
  });

  it('notify:skip: cadenceService.skipToday падает — сообщение об ошибке', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const botService = { getUserSettings: jest.fn().mockResolvedValue(null) };
    const { service, fakeBot } = makeService(botService, {
      skipToday: jest.fn().mockRejectedValue(new Error('db down')),
    });
    service.onModuleInit();
    const ctx = await runAction(fakeBot, 'notify:skip');
    expect(ctx.answerCbQuery).toHaveBeenCalledTimes(1);
    expect(ctx.reply).toHaveBeenCalledWith(ERROR_RETRY);
  });
});

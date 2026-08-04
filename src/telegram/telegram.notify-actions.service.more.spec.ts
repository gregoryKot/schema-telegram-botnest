// Продолжение telegram.notify-actions.service.spec.ts: catch-блоки, которых
// не было в исходном файле (addr, notify:pause, notify:pause:cancel,
// notify:slower, notify:skip) — см. отчёт покрытия src/telegram (аудит
// 2026-08). notify:pause:7 catch уже покрыт в исходном файле.
import { Logger } from '@nestjs/common';
import { TelegramNotifyActionsService } from './telegram.notify-actions.service';
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
  it('addr:ty: падение записи формы — answerCbQuery-фолбэк, ошибка залогирована', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const botService = {
      updateUserSettings: jest.fn().mockRejectedValue(new Error('db down')),
    };
    const { service, fakeBot } = makeService(botService);
    service.onModuleInit();
    const ctx = await runAction(fakeBot, 'addr:ty');
    expect(ctx.answerCbQuery).toHaveBeenLastCalledWith(
      expect.stringContaining('Не получилось сохранить'),
    );
  });

  it('notify:pause: editMessageReplyMarkup падает — answerCbQuery-фолбэк', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { service, fakeBot } = makeService({});
    service.onModuleInit();
    const ctx = await runAction(fakeBot, 'notify:pause', {
      editMessageReplyMarkup: jest.fn().mockRejectedValue(new Error('too old')),
    });
    expect(ctx.answerCbQuery).toHaveBeenLastCalledWith(
      expect.stringContaining('Не получилось'),
    );
  });

  it('notify:pause:cancel: answerCbQuery сам падает — ошибка залогирована, не бросает наружу', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { service, fakeBot } = makeService({});
    service.onModuleInit();
    await expect(
      runAction(fakeBot, 'notify:pause:cancel', {
        answerCbQuery: jest.fn().mockRejectedValue(new Error('expired query')),
      }),
    ).resolves.toBeDefined();
  });

  it('notify:slower: cadenceService.slower падает — answerCbQuery-фолбэк', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const botService = { getUserSettings: jest.fn().mockResolvedValue(null) };
    const { service, fakeBot } = makeService(botService, {
      slower: jest.fn().mockRejectedValue(new Error('db down')),
    });
    service.onModuleInit();
    const ctx = await runAction(fakeBot, 'notify:slower');
    expect(ctx.answerCbQuery).toHaveBeenLastCalledWith(
      expect.stringContaining('Не получилось сохранить'),
    );
  });

  it('notify:skip: cadenceService.skipToday падает — answerCbQuery-фолбэк', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const botService = { getUserSettings: jest.fn().mockResolvedValue(null) };
    const { service, fakeBot } = makeService(botService, {
      skipToday: jest.fn().mockRejectedValue(new Error('db down')),
    });
    service.onModuleInit();
    const ctx = await runAction(fakeBot, 'notify:skip');
    expect(ctx.answerCbQuery).toHaveBeenLastCalledWith(
      expect.stringContaining('Не получилось'),
    );
  });
});

// Продолжение telegram.notify-settings.service.spec.ts: settings:pick_quiet
// (экран выбора пресета тихих часов — до этого файла был вовсе непокрыт) и
// catch-блоки всех четырёх действий (pick_freq/freq/quiet/addr), см. отчёт
// покрытия src/telegram (аудит 2026-08).
import { Logger } from '@nestjs/common';
import { TelegramNotifySettingsService } from './telegram.notify-settings.service';
import { makeFakeBot, runAction } from './telegram.test-helpers.spec';

function makeService(botService: any) {
  const accountService = {
    setAdaptiveLevel: jest.fn().mockResolvedValue(undefined),
  };
  const scheduleService = {
    rescheduleForUser: jest.fn().mockResolvedValue(undefined),
  };
  const fakeBot = makeFakeBot();
  const service = new TelegramNotifySettingsService(
    fakeBot.bot,
    botService,
    accountService as any,
    scheduleService as any,
  );
  return { service, fakeBot, accountService, scheduleService };
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('TelegramNotifySettingsService — settings:pick_quiet', () => {
  it('показывает клавиатуру пресетов тихих часов, БД не трогает', async () => {
    const botService = {
      getUserSettings: jest.fn().mockResolvedValue({ notifyEnabled: true }),
      updateUserSettings: jest.fn(),
    };
    const { service, fakeBot } = makeService(botService);
    service.onModuleInit();
    const ctx = await runAction(fakeBot, 'settings:pick_quiet');
    expect(botService.updateUserSettings).not.toHaveBeenCalled();
    const [text, markup] = ctx.editMessageText.mock.calls[0];
    expect(text).toContain('Тихие часы');
    const buttons = markup.reply_markup.inline_keyboard.flat();
    expect(
      buttons.some((b: any) => b.callback_data === 'settings:quiet:22:8'),
    ).toBe(true);
    expect(buttons.at(-1)!.callback_data).toBe('settings:back');
  });
});

describe('TelegramNotifySettingsService — catch-блоки', () => {
  const failingBotService = () => ({
    getUserSettings: jest.fn().mockRejectedValue(new Error('db down')),
    updateUserSettings: jest.fn().mockRejectedValue(new Error('db down')),
  });

  it('settings:pick_freq: editMessageText падает — answerCbQuery-фолбэк', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { service, fakeBot } = makeService({ getUserSettings: jest.fn() });
    service.onModuleInit();
    const ctx = await runAction(fakeBot, 'settings:pick_freq', {
      editMessageText: jest.fn().mockRejectedValue(new Error('too old')),
    });
    expect(ctx.answerCbQuery).toHaveBeenLastCalledWith(
      expect.stringContaining('Не получилось'),
    );
  });

  it('settings:freq:2: падение записи в БД — answerCbQuery-фолбэк', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { service, fakeBot } = makeService(failingBotService());
    service.onModuleInit();
    const ctx = await runAction(fakeBot, 'settings:freq:2');
    expect(ctx.answerCbQuery).toHaveBeenLastCalledWith(
      expect.stringContaining('Не удалось'),
    );
  });

  it('settings:quiet:22:8: падение записи в БД — answerCbQuery-фолбэк', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { service, fakeBot } = makeService(failingBotService());
    service.onModuleInit();
    const ctx = await runAction(fakeBot, 'settings:quiet:22:8');
    expect(ctx.answerCbQuery).toHaveBeenLastCalledWith(
      expect.stringContaining('Не удалось'),
    );
  });

  it('settings:addr:vy: падение записи в БД — answerCbQuery-фолбэк', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { service, fakeBot } = makeService(failingBotService());
    service.onModuleInit();
    const ctx = await runAction(fakeBot, 'settings:addr:vy');
    expect(ctx.answerCbQuery).toHaveBeenLastCalledWith(
      expect.stringContaining('Не удалось'),
    );
  });
});

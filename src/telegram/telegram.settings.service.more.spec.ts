// Продолжение telegram.settings.service.spec.ts (лимит ~300 строк на файл,
// CLAUDE.md, — новые тесты вынесены сюда, а не дописаны в исходный файл):
// settings:pick_tz (экран выбора часового пояса — до этого файла был вовсе
// непокрыт) и оставшиеся catch-блоки (/settings, toggle_gamified, pick_hour,
// hour, tz, back), которые до сих пор были нулевыми ветками в отчёте
// покрытия src/telegram (аудит 2026-08).
import { Logger } from '@nestjs/common';
import { TelegramSettingsService } from './telegram.settings.service';
import {
  makeFakeBot,
  runCommand,
  runAction,
} from './telegram.test-helpers.spec';

const BASE_SETTINGS = {
  notifyEnabled: true,
  notifyLocalHour: 21,
  notifyTimezone: 'Europe/Moscow',
  notifyFrequency: 1,
  notifyQuietStart: 23,
  notifyQuietEnd: 7,
  notifyGamified: false,
  notifyPausedUntil: null,
  addressForm: 'ty',
};

function makeService(botService: any) {
  const notificationService = {
    cancelAll: jest.fn().mockResolvedValue(undefined),
  };
  const scheduleService = {
    rescheduleForUser: jest.fn().mockResolvedValue(undefined),
  };
  const fakeBot = makeFakeBot();
  const service = new TelegramSettingsService(
    fakeBot.bot,
    botService,
    notificationService as any,
    scheduleService as any,
  );
  return { service, fakeBot, notificationService, scheduleService };
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('TelegramSettingsService — settings:pick_tz', () => {
  it('показывает клавиатуру со всеми таймзонами (Москва среди них), БД не трогает', async () => {
    const botService = {
      getUserSettings: jest.fn().mockResolvedValue(BASE_SETTINGS),
      updateUserSettings: jest.fn(),
    };
    const { service, fakeBot } = makeService(botService);
    service.onModuleInit();
    const ctx = await runAction(fakeBot, 'settings:pick_tz');
    expect(botService.updateUserSettings).not.toHaveBeenCalled();
    const [text, markup] = ctx.editMessageText.mock.calls[0];
    expect(text).toContain('часовой пояс');
    const buttons = markup.reply_markup.inline_keyboard.flat();
    expect(
      buttons.some((b: any) => b.callback_data === 'settings:tz:Europe/Moscow'),
    ).toBe(true);
    // Последняя кнопка — навигация назад, не ещё одна таймзона.
    expect(buttons.at(-1)!.callback_data).toBe('settings:back');
  });
});

describe('TelegramSettingsService — catch-блоки (ни один хендлер не роняет процесс)', () => {
  const failingBotService = () => ({
    getUserSettings: jest.fn().mockRejectedValue(new Error('db down')),
    updateUserSettings: jest.fn().mockRejectedValue(new Error('db down')),
  });

  it('/settings: падение при загрузке — reply с извинением вместо экрана', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { service, fakeBot } = makeService(failingBotService());
    service.onModuleInit();
    const ctx = await runCommand(fakeBot, 'settings');
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Не удалось загрузить настройки'),
    );
  });

  it('settings:toggle_gamified: падение — answerCbQuery с подсказкой повторить', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { service, fakeBot } = makeService(failingBotService());
    service.onModuleInit();
    const ctx = await runAction(fakeBot, 'settings:toggle_gamified');
    expect(ctx.answerCbQuery).toHaveBeenLastCalledWith(
      expect.stringContaining('Не удалось'),
    );
  });

  it('settings:pick_hour: editMessageText падает — answerCbQuery-фолбэк, ошибка залогирована', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const botService = {
      getUserSettings: jest.fn(),
      updateUserSettings: jest.fn(),
    };
    const { service, fakeBot } = makeService(botService);
    service.onModuleInit();
    const ctx = await runAction(fakeBot, 'settings:pick_hour', {
      editMessageText: jest.fn().mockRejectedValue(new Error('too old')),
    });
    expect(ctx.answerCbQuery).toHaveBeenLastCalledWith(
      expect.stringContaining('Не удалось'),
    );
  });

  it('settings:hour:9: падение записи в БД — answerCbQuery-фолбэк', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { service, fakeBot } = makeService(failingBotService());
    service.onModuleInit();
    const ctx = await runAction(fakeBot, 'settings:hour:9');
    expect(ctx.answerCbQuery).toHaveBeenLastCalledWith(
      expect.stringContaining('Не удалось'),
    );
  });

  it('settings:tz:Europe/Berlin: падение записи в БД — answerCbQuery-фолбэк', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { service, fakeBot } = makeService(failingBotService());
    service.onModuleInit();
    const ctx = await runAction(fakeBot, 'settings:tz:Europe/Berlin');
    expect(ctx.answerCbQuery).toHaveBeenLastCalledWith(
      expect.stringContaining('Не удалось'),
    );
  });

  it('settings:back: падение чтения настроек — answerCbQuery-фолбэк', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { service, fakeBot } = makeService(failingBotService());
    service.onModuleInit();
    const ctx = await runAction(fakeBot, 'settings:back');
    expect(ctx.answerCbQuery).toHaveBeenLastCalledWith(
      expect.stringContaining('Не удалось'),
    );
  });
});

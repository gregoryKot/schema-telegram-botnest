// Поведенческие тесты /settings: экран рендерится из реальных настроек (не
// хардкода), каждый action отвечает answerCbQuery, пишет верное поле через
// botService.updateUserSettings и правит сообщение editMessageText (НЕ reply —
// правило CLAUDE.md «Telegram: editMessageText, не reply»).
import { Logger } from '@nestjs/common';
import {
  TelegramSettingsService,
  buildSettingsView,
} from './telegram.settings.service';
import {
  makeFakeBot,
  runCommand,
  runAction,
} from './telegram.test-helpers.spec';

const BASE_SETTINGS = {
  notifyEnabled: true,
  notifyLocalHour: 21,
  notifyTimezone: 'Europe/Moscow',
  notifyReminderEnabled: true,
  notifyFrequency: 1,
  notifyQuietStart: 23,
  notifyQuietEnd: 7,
  notifyGamified: false,
  notifyPausedUntil: null,
  notifyNextRemindDate: null,
  addressForm: 'ty',
};

function makeBotService(overrides: Record<string, any> = {}) {
  let settings: any = { ...BASE_SETTINGS, ...overrides };
  return {
    getUserSettings: jest.fn(() => Promise.resolve(settings)),
    updateUserSettings: jest.fn((_userId: bigint, patch: any) => {
      settings = { ...settings, ...patch };
      return Promise.resolve();
    }),
    _get: () => settings,
  };
}

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

describe('buildSettingsView', () => {
  it('пусто, если настроек нет — не выдумывает данные', async () => {
    const botService = { getUserSettings: jest.fn().mockResolvedValue(null) };
    const view = await buildSettingsView(botService as any, 1n);
    expect(view.text).toContain('не найдены');
  });

  it('строит текст из реальных полей настроек, форма «вы»', async () => {
    const botService = makeBotService({
      addressForm: 'vy',
      notifyGamified: true,
    });
    const view = await buildSettingsView(botService as any, 1n);
    expect(view.text).toContain('на «вы»');
    expect(view.text).toContain('🎮 включён');
    expect(view.text).toContain('21:00');
  });

  it('тихие часы выключены, если start === end', async () => {
    const botService = makeBotService({
      notifyQuietStart: 5,
      notifyQuietEnd: 5,
    });
    const view = await buildSettingsView(botService as any, 1n);
    expect(view.text).toContain('Тихие часы: выключены');
  });
});

describe('TelegramSettingsService — /settings command', () => {
  it('отвечает reply (первый вход в меню — это команда, не правка)', async () => {
    const { service, fakeBot } = makeService(makeBotService());
    await service.onModuleInit();
    const ctx = await runCommand(fakeBot, 'settings');
    expect(ctx.reply).toHaveBeenCalledTimes(1);
    expect(ctx.reply.mock.calls[0][0]).toContain('Настройки уведомлений');
  });
});

describe('TelegramSettingsService — settings:toggle', () => {
  it('answerCbQuery вызван, notifyEnabled инвертируется, редактирует (не reply)', async () => {
    const botService = makeBotService({ notifyEnabled: true });
    const { service, fakeBot, notificationService, scheduleService } =
      makeService(botService);
    await service.onModuleInit();
    const ctx = await runAction(fakeBot, 'settings:toggle');
    expect(ctx.answerCbQuery).toHaveBeenCalled();
    expect(botService.updateUserSettings).toHaveBeenCalledWith(1n, {
      notifyEnabled: false,
    });
    expect(botService._get().notifyEnabled).toBe(false);
    expect(notificationService.cancelAll).toHaveBeenCalledWith(1n);
    expect(scheduleService.rescheduleForUser).not.toHaveBeenCalled();
    expect(ctx.editMessageText).toHaveBeenCalledTimes(1);
    expect(ctx.reply).not.toHaveBeenCalled();
  });

  it('включение обратно — переплпнирует, а не отменяет', async () => {
    const botService = makeBotService({ notifyEnabled: false });
    const { service, fakeBot, notificationService, scheduleService } =
      makeService(botService);
    await service.onModuleInit();
    await runAction(fakeBot, 'settings:toggle');
    expect(botService._get().notifyEnabled).toBe(true);
    expect(scheduleService.rescheduleForUser).toHaveBeenCalledWith(1n);
    expect(notificationService.cancelAll).not.toHaveBeenCalled();
  });
});

describe('TelegramSettingsService — settings:toggle_gamified', () => {
  it('переключает notifyGamified и перепланирует', async () => {
    const botService = makeBotService({ notifyGamified: false });
    const { service, fakeBot, scheduleService } = makeService(botService);
    await service.onModuleInit();
    const ctx = await runAction(fakeBot, 'settings:toggle_gamified');
    expect(botService._get().notifyGamified).toBe(true);
    expect(scheduleService.rescheduleForUser).toHaveBeenCalledWith(1n);
    expect(ctx.editMessageText).toHaveBeenCalled();
  });
});

describe('TelegramSettingsService — час напоминания', () => {
  it('settings:hour:9 пишет notifyLocalHour=9 и перепланирует', async () => {
    const botService = makeBotService();
    const { service, fakeBot, scheduleService } = makeService(botService);
    await service.onModuleInit();
    const ctx = await runAction(fakeBot, 'settings:hour:9');
    expect(botService.updateUserSettings).toHaveBeenCalledWith(1n, {
      notifyLocalHour: 9,
    });
    expect(scheduleService.rescheduleForUser).toHaveBeenCalledWith(1n);
    expect(ctx.editMessageText).toHaveBeenCalled();
  });

  it('settings:pick_hour показывает клавиатуру часов, не трогает БД', async () => {
    const botService = makeBotService();
    const { service, fakeBot } = makeService(botService);
    await service.onModuleInit();
    const ctx = await runAction(fakeBot, 'settings:pick_hour');
    expect(botService.updateUserSettings).not.toHaveBeenCalled();
    expect(ctx.editMessageText).toHaveBeenCalled();
  });
});

describe('TelegramSettingsService — часовой пояс', () => {
  it('settings:tz:Europe/Berlin пишет валидную таймзону из списка', async () => {
    const botService = makeBotService();
    const { service, fakeBot, scheduleService } = makeService(botService);
    await service.onModuleInit();
    const ctx = await runAction(fakeBot, 'settings:tz:Europe/Berlin');
    expect(botService.updateUserSettings).toHaveBeenCalledWith(1n, {
      notifyTimezone: 'Europe/Berlin',
    });
    expect(scheduleService.rescheduleForUser).toHaveBeenCalledWith(1n);
    expect(ctx.editMessageText).toHaveBeenCalled();
  });

  it('таймзона не из белого списка — тихо игнорируется (без записи в БД)', async () => {
    const botService = makeBotService();
    const { service, fakeBot } = makeService(botService);
    await service.onModuleInit();
    const ctx = await runAction(fakeBot, 'settings:tz:Mars/Colony');
    expect(botService.updateUserSettings).not.toHaveBeenCalled();
    expect(ctx.editMessageText).not.toHaveBeenCalled();
    expect(ctx.answerCbQuery).toHaveBeenCalled();
  });
});

describe('TelegramSettingsService — settings:back', () => {
  it('просто перерисовывает экран настроек, без записи', async () => {
    const botService = makeBotService();
    const { service, fakeBot } = makeService(botService);
    await service.onModuleInit();
    const ctx = await runAction(fakeBot, 'settings:back');
    expect(botService.updateUserSettings).not.toHaveBeenCalled();
    expect(ctx.editMessageText).toHaveBeenCalled();
  });
});

describe('TelegramSettingsService — ошибки', () => {
  it('падение при чтении настроек не роняет хендлер, answerCbQuery с подсказкой', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const botService = {
      getUserSettings: jest.fn().mockRejectedValue(new Error('db down')),
      updateUserSettings: jest.fn(),
    };
    const { service, fakeBot } = makeService(botService);
    await service.onModuleInit();
    const ctx = await runAction(fakeBot, 'settings:toggle');
    expect(ctx.answerCbQuery).toHaveBeenCalledWith(
      expect.stringContaining('Не удалось'),
    );
  });
});

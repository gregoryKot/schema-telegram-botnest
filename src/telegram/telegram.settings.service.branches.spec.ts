// Ветки, не покрытые telegram.settings.service.(more.)spec.ts (аудит
// 2026-08, покрытие бэкенда): buildSettingsView — фолбэки для незнакомой
// таймзоны/отрицательного UTC-смещения/паузы/выключенных тихих часов/
// частоты вне диапазона; хендлеры — ранний выход без ctx.from.id (Telegram
// технически может прислать update без from — напр. канальный пост) и
// getUserSettings() === null внутри settings:toggle; onModuleInit() с
// bot === null (сборка без токена, см. CLAUDE.md про TELEGRAF_BOT/Optional).
import {
  TelegramSettingsService,
  buildSettingsView,
} from './telegram.settings.service';
import {
  makeFakeBot,
  runAction,
  runCommand,
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

describe('buildSettingsView — фолбэки', () => {
  it('незнакомая таймзона (не из TIMEZONES) — показывает сырую строку, не падает', async () => {
    const botService = {
      getUserSettings: jest.fn().mockResolvedValue({
        ...BASE_SETTINGS,
        notifyTimezone: 'Antarctica/Vostok',
      }),
    };
    const view = await buildSettingsView(botService as any, 1n);
    expect(view.text).toContain('Antarctica/Vostok');
  });

  it('отрицательное UTC-смещение форматируется без двойного минуса', async () => {
    const botService = {
      getUserSettings: jest.fn().mockResolvedValue({
        ...BASE_SETTINGS,
        notifyTimezone: 'America/New_York',
      }),
    };
    const view = await buildSettingsView(botService as any, 1n);
    expect(view.text).toMatch(/UTC-\d/);
    expect(view.text).not.toContain('UTC--');
  });

  it('пауза в будущем — показывает строку "на паузе до"', async () => {
    const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const botService = {
      getUserSettings: jest
        .fn()
        .mockResolvedValue({ ...BASE_SETTINGS, notifyPausedUntil: future }),
    };
    const view = await buildSettingsView(botService as any, 1n);
    expect(view.text).toContain('На паузе до');
  });

  it('частота вне диапазона CADENCE_LABELS — откатывается на "каждый день", не рисует undefined', async () => {
    const botService = {
      getUserSettings: jest
        .fn()
        .mockResolvedValue({ ...BASE_SETTINGS, notifyFrequency: 99 }),
    };
    const view = await buildSettingsView(botService as any, 1n);
    expect(view.text).toContain('Частота: каждый день');
    expect(view.text).not.toContain('undefined');
  });

  it('notifyFrequency отсутствует (null) — тоже трактуется как "каждый день"', async () => {
    const botService = {
      getUserSettings: jest
        .fn()
        .mockResolvedValue({ ...BASE_SETTINGS, notifyFrequency: null }),
    };
    const view = await buildSettingsView(botService as any, 1n);
    expect(view.text).toContain('Частота: каждый день');
  });
});

describe('TelegramSettingsService.onModuleInit — bot === null', () => {
  it('без бота (TELEGRAF_BOT не сконфигурирован) — не падает, хендлеры не регистрируются', () => {
    const notificationService = { cancelAll: jest.fn() };
    const scheduleService = { rescheduleForUser: jest.fn() };
    const botService = {
      getUserSettings: jest.fn(),
      updateUserSettings: jest.fn(),
    };
    const service = new TelegramSettingsService(
      null,
      botService as any,
      notificationService as any,
      scheduleService as any,
    );
    expect(() => service.onModuleInit()).not.toThrow();
  });
});

describe('TelegramSettingsService — update без ctx.from.id (не роняет хендлер)', () => {
  const botService = () => ({
    getUserSettings: jest.fn().mockResolvedValue(BASE_SETTINGS),
    updateUserSettings: jest.fn().mockResolvedValue(undefined),
  });

  it('/settings без from — тихо выходит, ничего не пишет', async () => {
    const svc = botService();
    const { service, fakeBot } = makeService(svc);
    service.onModuleInit();
    const ctx = await runCommand(fakeBot, 'settings', { from: undefined });
    expect(ctx.reply.mock.calls).toEqual([]);
    expect(svc.getUserSettings.mock.calls).toEqual([]);
  });

  it('settings:toggle без from — подтверждает клик, но БД не трогает', async () => {
    const svc = botService();
    const { service, fakeBot } = makeService(svc);
    service.onModuleInit();
    const ctx = await runAction(fakeBot, 'settings:toggle', {
      from: undefined,
    });
    // Вызван БЕЗ аргументов — это успешный «тихий» answerCbQuery, а не ветка
    // catch (та зовёт его с текстом-подсказкой «Не удалось…»).
    expect(ctx.answerCbQuery).toHaveBeenCalledWith();
    expect(svc.updateUserSettings.mock.calls).toEqual([]);
  });

  it('settings:toggle_gamified без from — подтверждает клик, но БД не трогает', async () => {
    const svc = botService();
    const { service, fakeBot } = makeService(svc);
    service.onModuleInit();
    const ctx = await runAction(fakeBot, 'settings:toggle_gamified', {
      from: undefined,
    });
    expect(ctx.answerCbQuery).toHaveBeenCalledWith();
    expect(svc.updateUserSettings.mock.calls).toEqual([]);
  });

  it('settings:hour:9 без from — не пишет notifyLocalHour', async () => {
    const svc = botService();
    const { service, fakeBot } = makeService(svc);
    service.onModuleInit();
    const ctx = await runAction(fakeBot, 'settings:hour:9', {
      from: undefined,
    });
    expect(ctx.answerCbQuery).toHaveBeenCalledWith();
    expect(svc.updateUserSettings.mock.calls).toEqual([]);
  });

  it('settings:tz:Europe/Berlin без from — не пишет notifyTimezone', async () => {
    const svc = botService();
    const { service, fakeBot } = makeService(svc);
    service.onModuleInit();
    const ctx = await runAction(fakeBot, 'settings:tz:Europe/Berlin', {
      from: undefined,
    });
    expect(ctx.answerCbQuery).toHaveBeenCalledWith();
    expect(svc.updateUserSettings.mock.calls).toEqual([]);
  });

  it('settings:back без from — не перерисовывает экран', async () => {
    const svc = botService();
    const { service, fakeBot } = makeService(svc);
    service.onModuleInit();
    const ctx = await runAction(fakeBot, 'settings:back', { from: undefined });
    expect(ctx.answerCbQuery).toHaveBeenCalledWith();
    expect(ctx.editMessageText.mock.calls).toEqual([]);
  });
});

describe('TelegramSettingsService — settings:toggle без сохранённых настроек', () => {
  it('getUserSettings() === null — считает notifyEnabled включённым по умолчанию и выключает', async () => {
    const svc = {
      getUserSettings: jest.fn().mockResolvedValue(null),
      updateUserSettings: jest.fn().mockResolvedValue(undefined),
    };
    const { service, fakeBot, notificationService } = makeService(svc);
    service.onModuleInit();
    await runAction(fakeBot, 'settings:toggle');
    // s == null → notifyEnabled по дефолту true → инверсия даёт false.
    expect(svc.updateUserSettings).toHaveBeenCalledWith(1n, {
      notifyEnabled: false,
    });
    expect(notificationService.cancelAll).toHaveBeenCalledWith(1n);
  });
});

// Поведенческие тесты /zv (публикация «Здорового Взрослого» вручную),
// notifyAdmin(), onModuleDestroy() и режима BOT_REDIRECT_USERNAME.
// answerCbQuery-до-БД здесь неприменим (это команды, не callback-кнопки) —
// вместо этого проверяем инвариант «ошибка публикации не роняет процесс».
import { Logger } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { makeFakeBot, runCommand } from './telegram.test-helpers.spec';

const OLD_ADMIN_ID = process.env.ADMIN_ID;
const OLD_REDIRECT = process.env.BOT_REDIRECT_USERNAME;

function makeDeps(overrides: Record<string, any> = {}) {
  const botService = {
    getUserSettings: jest.fn().mockResolvedValue(null),
    hasAcceptedDisclaimer: jest.fn().mockResolvedValue(true),
    cancelAllPreReminders: jest.fn().mockResolvedValue(0),
    ...overrides.botService,
  };
  const analyticsService = {
    getAdminStats: jest.fn().mockResolvedValue('core'),
    ...overrides.analyticsService,
  };
  const statsReport = {
    render: jest.fn().mockResolvedValue(''),
    ...overrides.statsReport,
  };
  const healthyAdultService = {
    poolStatus: jest
      .fn()
      .mockResolvedValue({ enabled: 0, unused: 0, daysLeft: 0 }),
    ...overrides.healthyAdultService,
  };
  const accountService = {
    registerUser: jest.fn().mockResolvedValue(undefined),
    ...overrides.accountService,
  };
  const pairsService = {
    joinPair: jest.fn().mockResolvedValue(true),
    ...overrides.pairsService,
  };
  const practicesService = {
    checkinPlan: jest.fn().mockResolvedValue(undefined),
    ...overrides.practicesService,
  };
  const notificationService = {
    cancel: jest.fn().mockResolvedValue(undefined),
    schedule: jest.fn().mockResolvedValue(undefined),
    ...overrides.notificationService,
  };
  const therapistRequestService = {
    approve: jest.fn().mockResolvedValue(undefined),
    reject: jest.fn().mockResolvedValue(undefined),
    ...overrides.therapistRequestService,
  };
  const publisher = {
    publish: jest
      .fn()
      .mockResolvedValue({ ok: true, message: '✅ Опубликовано' }),
    ...overrides.publisher,
  };
  const channelCheck = {
    log: jest.fn().mockResolvedValue('журнал пуст'),
    checkOne: jest
      .fn()
      .mockResolvedValue({ ok: true, message: '✅ telegram ок' }),
    ...overrides.channelCheck,
  };
  const fakeBot = makeFakeBot();
  const service = new TelegramService(
    fakeBot.bot,
    botService,
    analyticsService,
    statsReport,
    healthyAdultService,
    accountService,
    pairsService,
    practicesService,
    notificationService,
    therapistRequestService,
    publisher,
    channelCheck,
  );
  return { service, fakeBot, publisher, channelCheck, statsReport };
}

beforeEach(() => {
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
  if (OLD_ADMIN_ID === undefined) delete process.env.ADMIN_ID;
  else process.env.ADMIN_ID = OLD_ADMIN_ID;
  if (OLD_REDIRECT === undefined) delete process.env.BOT_REDIRECT_USERNAME;
  else process.env.BOT_REDIRECT_USERNAME = OLD_REDIRECT;
});

describe('TelegramService — /zv (только админ)', () => {
  it('не-админ получает отказ, publisher не вызывается', async () => {
    process.env.ADMIN_ID = '999';
    const { service, fakeBot, publisher } = makeDeps();
    service.onModuleInit();
    const ctx = await runCommand(fakeBot, 'zv', {
      from: { id: 1 },
      message: { text: '/zv' },
    });
    expect(ctx.reply).toHaveBeenCalledWith('⛔ Нет доступа');
    expect(publisher.publish).not.toHaveBeenCalled();
  });

  it('/zv без аргумента — рассылает по всем площадкам через publisher.publish()', async () => {
    process.env.ADMIN_ID = '999';
    const { service, fakeBot, publisher } = makeDeps();
    service.onModuleInit();
    const ctx = await runCommand(fakeBot, 'zv', {
      from: { id: 999 },
      message: { text: '/zv' },
    });
    expect(publisher.publish).toHaveBeenCalledWith();
    expect(ctx.reply).toHaveBeenCalledWith('✅ Опубликовано');
  });

  it('/zv <площадка> — проверяет ровно эту площадку через channelCheck.checkOne', async () => {
    process.env.ADMIN_ID = '999';
    const { service, fakeBot, channelCheck, publisher } = makeDeps();
    service.onModuleInit();
    const ctx = await runCommand(fakeBot, 'zv', {
      from: { id: 999 },
      message: { text: '/zv telegram' },
    });
    expect(channelCheck.checkOne).toHaveBeenCalledWith('telegram');
    expect(publisher.publish).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith('✅ telegram ок');
  });

  it('/zv log — журнал последних отправок через channelCheck.log()', async () => {
    process.env.ADMIN_ID = '999';
    const { service, fakeBot, channelCheck } = makeDeps({
      channelCheck: { log: jest.fn().mockResolvedValue('лог: 3 записи') },
    });
    service.onModuleInit();
    const ctx = await runCommand(fakeBot, 'zv', {
      from: { id: 999 },
      message: { text: '/zv log' },
    });
    expect(channelCheck.log).toHaveBeenCalledWith();
    expect(ctx.reply).toHaveBeenCalledWith('лог: 3 записи');
  });

  it('publisher.publish падает — не роняет хендлер, отвечает текстом ошибки', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    process.env.ADMIN_ID = '999';
    const { service, fakeBot } = makeDeps({
      publisher: {
        publish: jest.fn().mockRejectedValue(new Error('MAX down')),
      },
    });
    service.onModuleInit();
    const ctx = await runCommand(fakeBot, 'zv', {
      from: { id: 999 },
      message: { text: '/zv' },
    });
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('MAX down'));
  });
});

describe('TelegramService — /stats падение аналитики', () => {
  it('getAdminStats бросает — не роняет хендлер, отвечает усечённым текстом ошибки', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    process.env.ADMIN_ID = '999';
    const { service, fakeBot } = makeDeps({
      analyticsService: {
        getAdminStats: jest.fn().mockRejectedValue(new Error('db down')),
      },
    });
    service.onModuleInit();
    const ctx = await runCommand(fakeBot, 'stats', { from: { id: 999 } });
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('db down'));
  });
});

describe('TelegramService — notifyAdmin', () => {
  it('ADMIN_ID не задан — возвращает false, ничего не шлёт', async () => {
    delete process.env.ADMIN_ID;
    const { service, fakeBot } = makeDeps();
    const ok = await service.notifyAdmin('привет админу');
    expect(ok).toBe(false);
    expect(fakeBot.telegram.sendMessage).not.toHaveBeenCalled();
  });

  it('успех — шлёт HTML-сообщение админу, возвращает true', async () => {
    process.env.ADMIN_ID = '999';
    const { service, fakeBot } = makeDeps();
    const ok = await service.notifyAdmin('🚨 инцидент');
    expect(ok).toBe(true);
    expect(fakeBot.telegram.sendMessage).toHaveBeenCalledWith(
      '999',
      '🚨 инцидент',
      { parse_mode: 'HTML' },
    );
  });

  it('sendMessage падает — возвращает false, ошибка залогирована, не бросает', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    process.env.ADMIN_ID = '999';
    const { service, fakeBot } = makeDeps();
    fakeBot.telegram.sendMessage.mockRejectedValueOnce(new Error('blocked'));
    await expect(service.notifyAdmin('x')).resolves.toBe(false);
  });
});

describe('TelegramService — onModuleDestroy', () => {
  it('останавливает бота и не бросает, даже если bot.stop() кидает (штатное закрытие)', () => {
    const { service, fakeBot } = makeDeps();
    (fakeBot.bot.stop as jest.Mock).mockImplementation(() => {
      throw new Error('already stopped');
    });
    expect(() => service.onModuleDestroy()).not.toThrow();
    expect(fakeBot.bot.stop).toHaveBeenCalledWith();
  });
});

describe('TelegramService — BOT_REDIRECT_USERNAME (режим переезда)', () => {
  it('регистрирует только message/callback_query редиректы и launch, не обычные команды', () => {
    process.env.BOT_REDIRECT_USERNAME = 'new_schema_bot';
    const { service, fakeBot } = makeDeps();
    service.onModuleInit();
    expect(fakeBot.bot.on).toHaveBeenCalledWith(
      'message',
      expect.any(Function),
    );
    expect(fakeBot.bot.on).toHaveBeenCalledWith(
      'callback_query',
      expect.any(Function),
    );
    // Обычные /start-и-подобные хендлеры в редирект-режиме не регистрируются —
    // иначе юзер получал бы и старое поведение, и редирект одновременно.
    expect(fakeBot.commands.has('start')).toBe(false);
    expect(fakeBot.bot.launch).toHaveBeenCalledWith({
      dropPendingUpdates: true,
    });
  });

  it('message-хендлер отвечает текстом с новым username бота', async () => {
    process.env.BOT_REDIRECT_USERNAME = 'new_schema_bot';
    const { service, fakeBot } = makeDeps();
    service.onModuleInit();
    const onMessageHandler = (fakeBot.bot.on as jest.Mock).mock.calls.find(
      (c) => c[0] === 'message',
    )![1];
    const ctx = { reply: jest.fn().mockResolvedValue(undefined) };
    await onMessageHandler(ctx);
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('@new_schema_bot'),
    );
  });

  it('callback_query-хендлер отвечает answerCbQuery с show_alert', async () => {
    process.env.BOT_REDIRECT_USERNAME = 'new_schema_bot';
    const { service, fakeBot } = makeDeps();
    service.onModuleInit();
    const onCbHandler = (fakeBot.bot.on as jest.Mock).mock.calls.find(
      (c) => c[0] === 'callback_query',
    )![1];
    const ctx = { answerCbQuery: jest.fn().mockResolvedValue(undefined) };
    await onCbHandler(ctx);
    expect(ctx.answerCbQuery).toHaveBeenCalledWith(
      expect.stringContaining('@new_schema_bot'),
      { show_alert: true },
    );
  });
});

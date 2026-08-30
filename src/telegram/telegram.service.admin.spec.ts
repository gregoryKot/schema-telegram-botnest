// notifyAdmin(), onModuleDestroy() и режима BOT_REDIRECT_USERNAME.
// /zv, /stats, /testdonate, /zayavki, /broadcast, treq — вынесены на
// TelegramAdminService (правило №10 CLAUDE.md — лимит размера файла), см.
// telegram.admin.service.*.spec.ts.
import { Logger } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { makeFakeBot } from './telegram.test-helpers.spec';

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
    ...overrides.analyticsService,
  };
  const accountService = {
    registerUser: jest.fn().mockResolvedValue(undefined),
    // Канонический номер: по умолчанию совпадает с telegramId (пользователь
    // бота без отдельного веб-входа). Спеки про слияние переопределяют.
    canonicalUserId: jest.fn(async (id: number) => BigInt(id)),
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
  const analyticsEvents = {
    track: jest.fn().mockResolvedValue(undefined),
    ...overrides.analyticsEvents,
  };
  const fakeBot = makeFakeBot();
  const service = new TelegramService(
    fakeBot.bot,
    botService,
    analyticsService,
    accountService,
    pairsService,
    practicesService,
    notificationService,
    analyticsEvents,
  );
  return { service, fakeBot };
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

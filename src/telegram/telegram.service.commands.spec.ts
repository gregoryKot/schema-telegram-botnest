// Поведенческие тесты простых команд TelegramService, непокрытых основным
// telegram.service.spec.ts: ping/subscribe/donate/about/therapist.
// /testdonate, /zayavki, /broadcast, /zv, /stats — вынесены на
// TelegramAdminService (правило №10 CLAUDE.md — лимит размера файла), см.
// telegram.admin.service.*.spec.ts.
import { Logger } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { makeFakeBot, runCommand } from './telegram.test-helpers.spec';

function makeDeps(overrides: Record<string, any> = {}) {
  const botService = {
    getUserSettings: jest.fn().mockResolvedValue(null),
    hasAcceptedDisclaimer: jest.fn().mockResolvedValue(true),
    cancelAllPreReminders: jest.fn().mockResolvedValue(0),
    ...overrides.botService,
  };
  const analyticsService = {
    getConsecutiveDays: jest.fn().mockResolvedValue(0),
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
  return {
    service,
    fakeBot,
    botService,
    accountService,
  };
}

beforeEach(() => {
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('TelegramService — /ping', () => {
  it('отвечает "OK"', async () => {
    const { service, fakeBot } = makeDeps();
    service.onModuleInit();
    const ctx = await runCommand(fakeBot, 'ping');
    expect(ctx.reply).toHaveBeenCalledWith('OK');
  });
});

describe('TelegramService — /subscribe', () => {
  it('показывает донат-кнопку (подписка временно скрыта)', async () => {
    const { service, fakeBot } = makeDeps();
    service.onModuleInit();
    const ctx = await runCommand(fakeBot, 'subscribe');
    const [text, opts] = ctx.reply.mock.calls[0];
    expect(text).toContain('Поддержать SchemeHappens');
    expect(opts.reply_markup.inline_keyboard[0][0].text).toBe('Разовый донат');
  });
});

describe('TelegramService — /donate', () => {
  it('отправляет HTML-сообщение с кнопкой доната', async () => {
    const { service, fakeBot } = makeDeps();
    service.onModuleInit();
    const ctx = await runCommand(fakeBot, 'donate');
    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const [, opts] = ctx.reply.mock.calls[0];
    expect(opts.parse_mode).toBe('HTML');
  });

  it('если reply с кнопкой падает — фолбэк на текст со ссылкой без inline-кнопки', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { service, fakeBot } = makeDeps();
    service.onModuleInit();
    const handler = fakeBot.commands.get('donate')!;
    let call = 0;
    const ctx: any = {
      from: { id: 1 },
      reply: jest.fn(() => {
        call++;
        return call === 1
          ? Promise.reject(new Error('bad url'))
          : Promise.resolve(undefined);
      }),
    };
    await handler(ctx);
    expect(ctx.reply).toHaveBeenCalledTimes(2);
    const [fallbackText, fallbackOpts] = ctx.reply.mock.calls[1];
    expect(fallbackText).toContain('http');
    expect(fallbackOpts).toEqual({ parse_mode: 'HTML' });
  });
});

describe('TelegramService — /about', () => {
  it('отправляет HTML-описание с донат-кнопкой', async () => {
    const { service, fakeBot } = makeDeps();
    service.onModuleInit();
    const ctx = await runCommand(fakeBot, 'about');
    const [text, opts] = ctx.reply.mock.calls[0];
    expect(text).toContain('Всё по схеме');
    expect(opts.parse_mode).toBe('HTML');
  });

  it('если reply падает — фолбэк текстом с донат-ссылкой', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { service, fakeBot } = makeDeps();
    service.onModuleInit();
    const handler = fakeBot.commands.get('about')!;
    let call = 0;
    const ctx: any = {
      from: { id: 1 },
      reply: jest.fn(() => {
        call++;
        return call === 1
          ? Promise.reject(new Error('bad url'))
          : Promise.resolve(undefined);
      }),
    };
    await handler(ctx);
    expect(ctx.reply).toHaveBeenCalledTimes(2);
    expect(ctx.reply.mock.calls[1][0]).toContain('💛');
  });
});

describe('TelegramService — /therapist (deprecated redirect)', () => {
  it('отправляет инструкцию идти в мини-апп, ровно одним сообщением', async () => {
    const { service, fakeBot } = makeDeps();
    service.onModuleInit();
    const ctx = await runCommand(fakeBot, 'therapist');
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('мини-апп'));
    // Хендлер вообще не зависит от therapistRequestService (она уехала на
    // TelegramAdminService) — единственный сайд-эффект команды это reply.
    expect(ctx.reply).toHaveBeenCalledTimes(1);
  });
});

// Поведенческие тесты простых команд TelegramService, непокрытых основным
// telegram.service.spec.ts: ping/subscribe/donate/testdonate/about/therapist.
// /zayavki и /broadcast — telegram.service.broadcast.spec.ts, /zv и
// notifyAdmin() — telegram.service.admin.spec.ts (лимит ~300 строк на файл,
// CLAUDE.md). Общий makeDeps передаёт ВСЕ 12 конструкторных зависимостей,
// включая channelCheck — в соседнем telegram.service.spec.ts его не было
// вовсе (дефект, описан в отчёте), из-за чего /zv никогда не тестировался.
import { Logger } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { makeFakeBot, runCommand } from './telegram.test-helpers.spec';

const OLD_ADMIN_ID = process.env.ADMIN_ID;

function makeDeps(overrides: Record<string, any> = {}) {
  const botService = {
    getUserSettings: jest.fn().mockResolvedValue(null),
    hasAcceptedDisclaimer: jest.fn().mockResolvedValue(true),
    cancelAllPreReminders: jest.fn().mockResolvedValue(0),
    ...overrides.botService,
  };
  const analyticsService = {
    getAdminStats: jest.fn().mockResolvedValue('core'),
    getConsecutiveDays: jest.fn().mockResolvedValue(0),
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
    getBroadcastUserIds: jest.fn().mockResolvedValue([]),
    markUserBlocked: jest.fn().mockResolvedValue(undefined),
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
    listPending: jest.fn().mockResolvedValue([]),
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
  const analyticsEvents = {
    track: jest.fn().mockResolvedValue(undefined),
    ...overrides.analyticsEvents,
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
    analyticsEvents,
  );
  return {
    service,
    fakeBot,
    botService,
    accountService,
    therapistRequestService,
    publisher,
    channelCheck,
  };
}

beforeEach(() => {
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
  if (OLD_ADMIN_ID === undefined) delete process.env.ADMIN_ID;
  else process.env.ADMIN_ID = OLD_ADMIN_ID;
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

describe('TelegramService — /testdonate (только админ)', () => {
  it('не-админ получает отказ', async () => {
    process.env.ADMIN_ID = '999';
    const { service, fakeBot } = makeDeps();
    service.onModuleInit();
    const ctx = await runCommand(fakeBot, 'testdonate', { from: { id: 1 } });
    expect(ctx.reply).toHaveBeenCalledWith('⛔ Нет доступа');
  });

  it('админ получает превью шаблона donate_reminder', async () => {
    process.env.ADMIN_ID = '999';
    const { service, fakeBot } = makeDeps();
    service.onModuleInit();
    const ctx = await runCommand(fakeBot, 'testdonate', { from: { id: 999 } });
    // Проверяем содержимое, а не факт ответа: команда существует ради
    // превью — пустой или чужой текст означал бы, что админ смотрит не то,
    // что уйдёт пользователю.
    const [text] = ctx.reply.mock.calls[0] as [string];
    expect(text).not.toBe('⛔ Нет доступа');
    expect(text.length).toBeGreaterThan(20);
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
  it('отправляет инструкцию идти в мини-апп, ничего не пишет в БД', async () => {
    const { service, fakeBot, therapistRequestService } = makeDeps();
    service.onModuleInit();
    const ctx = await runCommand(fakeBot, 'therapist');
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('мини-апп'));
    expect(therapistRequestService.approve).not.toHaveBeenCalled();
  });
});

// /zayavki и /broadcast — в telegram.service.broadcast.spec.ts (лимит ~300
// строк на файл, CLAUDE.md).

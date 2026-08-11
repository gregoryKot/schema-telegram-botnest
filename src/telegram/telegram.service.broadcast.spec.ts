// Продолжение telegram.service.commands.spec.ts (лимит ~300 строк на файл,
// CLAUDE.md — вынесено в отдельный файл): /zayavki (фолбэк-доступ к заявкам
// терапевта) и /broadcast (массовая рассылка админа).
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
    publish: jest.fn().mockResolvedValue({ ok: true, message: 'ok' }),
    ...overrides.publisher,
  };
  const channelCheck = {
    log: jest.fn().mockResolvedValue(''),
    checkOne: jest.fn().mockResolvedValue({ ok: true, message: 'ok' }),
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
  return { service, fakeBot, accountService, therapistRequestService };
}

beforeEach(() => {
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
  if (OLD_ADMIN_ID === undefined) delete process.env.ADMIN_ID;
  else process.env.ADMIN_ID = OLD_ADMIN_ID;
});

describe('TelegramService — /zayavki (только админ, фолбэк-доступ к заявкам)', () => {
  it('не-админ получает отказ, listPending не вызывается', async () => {
    process.env.ADMIN_ID = '999';
    const { service, fakeBot, therapistRequestService } = makeDeps();
    service.onModuleInit();
    const ctx = await runCommand(fakeBot, 'zayavki', { from: { id: 1 } });
    expect(ctx.reply).toHaveBeenCalledWith('Только админ');
    expect(therapistRequestService.listPending).not.toHaveBeenCalled();
  });

  it('нет заявок — сообщение "Заявок нет", без карточек', async () => {
    process.env.ADMIN_ID = '999';
    const { service, fakeBot } = makeDeps();
    service.onModuleInit();
    const ctx = await runCommand(fakeBot, 'zayavki', { from: { id: 999 } });
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Заявок на роль терапевта нет'),
    );
  });

  it('есть заявки — каждая карточка содержит id, экранированные поля и Approve/Reject callback_data', async () => {
    process.env.ADMIN_ID = '999';
    const { service, fakeBot } = makeDeps({
      therapistRequestService: {
        listPending: jest.fn().mockResolvedValue([
          {
            id: 5,
            userId: 42n,
            fullName: 'Иван <script>',
            qualification: 'КПТ',
            contacts: '@ivan',
            message: null,
          },
        ]),
      },
    });
    service.onModuleInit();
    const ctx = await runCommand(fakeBot, 'zayavki', { from: { id: 999 } });
    const [text, opts] = ctx.reply.mock.calls[0];
    expect(text).toContain('Заявка #5');
    expect(text).toContain('&lt;script&gt;'); // XSS-экранирование имени
    const buttons = opts.reply_markup.inline_keyboard[0];
    expect(buttons).toEqual([
      { text: '✅ Approve', callback_data: 'treq:approve:5' },
      { text: '❌ Reject', callback_data: 'treq:reject:5' },
    ]);
  });
});

describe('TelegramService — /broadcast (только админ)', () => {
  it('не-админ получает отказ, рассылка не запускается', async () => {
    process.env.ADMIN_ID = '999';
    const { service, fakeBot, accountService } = makeDeps();
    service.onModuleInit();
    const ctx = await runCommand(fakeBot, 'broadcast', {
      from: { id: 1 },
      message: { text: '/broadcast привет' },
    });
    expect(ctx.reply).toHaveBeenCalledWith('⛔ Нет доступа');
    expect(accountService.getBroadcastUserIds).not.toHaveBeenCalled();
  });

  it('админ без текста — подсказка формата, рассылка не запускается', async () => {
    process.env.ADMIN_ID = '999';
    const { service, fakeBot, accountService } = makeDeps();
    service.onModuleInit();
    const ctx = await runCommand(fakeBot, 'broadcast', {
      from: { id: 999 },
      message: { text: '/broadcast' },
    });
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('/broadcast <сообщение>'),
    );
    expect(accountService.getBroadcastUserIds).not.toHaveBeenCalled();
  });

  it('успех + перманентная ошибка (403) — считает sent/failed раздельно, блокирует юзера', async () => {
    process.env.ADMIN_ID = '999';
    const { service, fakeBot, accountService } = makeDeps({
      accountService: {
        getBroadcastUserIds: jest.fn().mockResolvedValue([1, 2]),
      },
    });
    service.onModuleInit();
    const sendMessage = fakeBot.telegram.sendMessage;
    sendMessage
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce({ response: { error_code: 403 } });
    const ctx = await runCommand(fakeBot, 'broadcast', {
      from: { id: 999 },
      message: { text: '/broadcast всем привет' },
    });
    expect(sendMessage).toHaveBeenCalledWith(1, 'всем привет', {
      parse_mode: undefined,
    });
    expect(accountService.markUserBlocked).toHaveBeenCalledWith(2n);
    const summary = ctx.reply.mock.calls.at(-1)![0];
    expect(summary).toContain('1 доставлено');
    expect(summary).toContain('1 ошибок');
  }, 10_000);

  it('markUserBlocked падает — рассылка всё равно завершается и сбой попадает в лог', async () => {
    process.env.ADMIN_ID = '999';
    const dbError = new Error('db down');
    const { service, fakeBot, accountService } = makeDeps({
      accountService: {
        getBroadcastUserIds: jest.fn().mockResolvedValue([2]),
        markUserBlocked: jest.fn().mockRejectedValue(dbError),
      },
    });
    service.onModuleInit();
    const warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    fakeBot.telegram.sendMessage.mockRejectedValueOnce({
      response: { error_code: 403 },
    });
    const ctx = await runCommand(fakeBot, 'broadcast', {
      from: { id: 999 },
      message: { text: '/broadcast всем привет' },
    });
    expect(accountService.markUserBlocked).toHaveBeenCalledWith(2n);
    expect(warnSpy).toHaveBeenCalledWith('markUserBlocked failed', dbError);
    const summary = ctx.reply.mock.calls.at(-1)![0];
    expect(summary).toContain('1 ошибок');
  }, 10_000);
});

// Поведенческие тесты TelegramAdminService: /zv (публикация «Здорового
// Взрослого» вручную), /stats и /testdonate. Перенесено из
// telegram.service.admin.spec.ts / telegram.service.spec.ts /
// telegram.service.commands.spec.ts при выносе админ-хендлеров в отдельный
// сервис (правило №10 CLAUDE.md — лимит размера файла). treq и
// /zayavki+/broadcast — в telegram.admin.service.treq.spec.ts и
// telegram.admin.service.broadcast.spec.ts (тот же лимит).
import { Logger } from '@nestjs/common';
import { TelegramAdminService } from './telegram.admin.service';
import { makeFakeBot, runCommand } from './telegram.test-helpers.spec';

const OLD_ADMIN_ID = process.env.ADMIN_ID;

function makeDeps(overrides: Record<string, any> = {}) {
  const adminStatsService = {
    getAdminStats: jest.fn().mockResolvedValue('core'),
    ...overrides.adminStatsService,
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
  const accountService = { ...overrides.accountService };
  const therapistRequestService = { ...overrides.therapistRequestService };
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
  const service = new TelegramAdminService(
    fakeBot.bot,
    adminStatsService,
    statsReport,
    healthyAdultService,
    accountService,
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
});

describe('TelegramAdminService — /zv (только админ)', () => {
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

describe('TelegramAdminService — /stats падение аналитики', () => {
  it('getAdminStats бросает — не роняет хендлер, отвечает усечённым текстом ошибки', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    process.env.ADMIN_ID = '999';
    const { service, fakeBot } = makeDeps({
      adminStatsService: {
        getAdminStats: jest.fn().mockRejectedValue(new Error('db down')),
      },
    });
    service.onModuleInit();
    const ctx = await runCommand(fakeBot, 'stats', { from: { id: 999 } });
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('db down'));
  });
});

describe('TelegramAdminService — /stats (только админ)', () => {
  it('не-админ получает отказ, метрики не запрашиваются', async () => {
    process.env.ADMIN_ID = '999';
    const { service, fakeBot, statsReport } = makeDeps();
    service.onModuleInit();
    const ctx = await runCommand(fakeBot, 'stats', { from: { id: 1 } });
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('доступа'));
    expect(statsReport.render).not.toHaveBeenCalled();
  });

  it('админ: второе сообщение содержит склеенный отчёт (StatsReportService)', async () => {
    process.env.ADMIN_ID = '999';
    const { service, fakeBot, statsReport } = makeDeps({
      adminStatsService: {
        getAdminStats: jest.fn().mockResolvedValue('core stats'),
      },
      statsReport: {
        render: jest
          .fn()
          .mockResolvedValue('продуктовые метрики\n\nкарточки режимов: 9'),
      },
    });
    service.onModuleInit();
    const ctx = await runCommand(fakeBot, 'stats', { from: { id: 999 } });
    expect(statsReport.render).toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenNthCalledWith(1, 'core stats', {
      parse_mode: 'HTML',
    });
    expect(ctx.reply).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('продуктовые метрики'),
      { parse_mode: 'HTML' },
    );
    expect(ctx.reply).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('карточки режимов: 9'),
      { parse_mode: 'HTML' },
    );
  });
});

describe('TelegramAdminService — /testdonate (только админ)', () => {
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

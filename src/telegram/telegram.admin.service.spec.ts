// Поведенческие тесты TelegramAdminService: /zv (публикация «Здорового
// Взрослого» вручную), /stats и /testdonate. Перенесено из
// telegram.service.admin.spec.ts / telegram.service.spec.ts /
// telegram.service.commands.spec.ts при выносе админ-хендлеров в отдельный
// сервис (правило №10 CLAUDE.md — лимит размера файла). treq и
// /zayavki+/broadcast — в telegram.admin.service.treq.spec.ts и
// telegram.admin.service.broadcast.spec.ts (тот же лимит).
import { Logger } from '@nestjs/common';
import { TelegramAdminService } from './telegram.admin.service';
import { BLOCK_FAILED_MARK } from '../bot/stats-settle';
import { makeFakeBot, runCommand } from './telegram.test-helpers.spec';
import { ZV_BUSY, ZV_STARTED } from './zv-runner';

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
    await service.zv.current;
    expect(publisher.publish).toHaveBeenCalledWith();
    expect(ctx.reply.mock.calls).toEqual([[ZV_STARTED], ['✅ Опубликовано']]);
  });

  // E16 (аудит 2026-11): публикация ждалась в обработчике, и Telegraf держал
  // всю пачку апдейтов — бот замирал для всех до 90 с.
  it('/zv не держит обработчик: итог приходит отдельным сообщением', async () => {
    process.env.ADMIN_ID = '999';
    let finish: (r: { message: string }) => void = () => undefined;
    const { service, fakeBot } = makeDeps({
      publisher: {
        publish: jest.fn(
          () => new Promise<{ message: string }>((r) => (finish = r)),
        ),
      },
    });
    service.onModuleInit();
    const ctx = await runCommand(fakeBot, 'zv', {
      from: { id: 999 },
      message: { text: '/zv' },
    });
    // Обработчик вернулся, пока публикация ещё идёт.
    expect(ctx.reply.mock.calls).toEqual([[ZV_STARTED]]);
    finish({ message: '✅ Опубликовано' });
    await service.zv.current;
    expect(ctx.reply).toHaveBeenLastCalledWith('✅ Опубликовано');
  });

  it('второй /zv, пока идёт первый, не публикует ещё раз', async () => {
    process.env.ADMIN_ID = '999';
    const publish = jest.fn(() => new Promise(() => undefined));
    const { service, fakeBot } = makeDeps({ publisher: { publish } });
    service.onModuleInit();
    const msg = { from: { id: 999 }, message: { text: '/zv' } };
    await runCommand(fakeBot, 'zv', msg);
    await new Promise((r) => setImmediate(r));
    const second = await runCommand(fakeBot, 'zv', msg);
    expect(publish).toHaveBeenCalledTimes(1);
    expect(second.reply).toHaveBeenCalledWith(ZV_BUSY);
  });

  it('/zv <площадка> — проверяет ровно эту площадку через channelCheck.checkOne', async () => {
    process.env.ADMIN_ID = '999';
    const { service, fakeBot, channelCheck, publisher } = makeDeps();
    service.onModuleInit();
    const ctx = await runCommand(fakeBot, 'zv', {
      from: { id: 999 },
      message: { text: '/zv telegram' },
    });
    await service.zv.current;
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
    const errors = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
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
    await service.zv.current;
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('MAX down'));
    expect(errors).toHaveBeenCalledWith('zv command failed', expect.any(Error));
  });
});

describe('TelegramAdminService — /stats падение аналитики', () => {
  const replies = (ctx: { reply: jest.Mock }): string[] =>
    ctx.reply.mock.calls.map((c) => String(c[0]));

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    process.env.ADMIN_ID = '999';
  });

  it('getAdminStats бросает — первое сообщение это заглушка с причиной, второе всё равно уходит', async () => {
    const { service, fakeBot } = makeDeps({
      adminStatsService: {
        getAdminStats: jest.fn().mockRejectedValue(new Error('db down')),
      },
      statsReport: {
        render: jest.fn().mockResolvedValue('продуктовые метрики'),
      },
    });
    service.onModuleInit();
    const ctx = await runCommand(fakeBot, 'stats', {
      from: { id: 999 },
      message: { text: '/stats all' },
    });
    const [first, second] = replies(ctx);
    expect(first).toContain('Главные цифры');
    expect(first).toContain(BLOCK_FAILED_MARK);
    expect(first).toContain('db down');
    expect(second).toContain('продуктовые метрики');
    expect(second).toContain('Здоровый Взрослый');
    expect(ctx.reply).toHaveBeenCalledTimes(2);
  });

  it('poolStatus бросает — оба сообщения ушли, вместо запаса фраз заглушка', async () => {
    const { service, fakeBot } = makeDeps({
      adminStatsService: {
        getAdminStats: jest.fn().mockResolvedValue('core stats'),
      },
      statsReport: {
        render: jest.fn().mockResolvedValue('продуктовые метрики'),
      },
      healthyAdultService: {
        poolStatus: jest.fn().mockRejectedValue(new Error('pool down')),
      },
    });
    service.onModuleInit();
    const ctx = await runCommand(fakeBot, 'stats', {
      from: { id: 999 },
      message: { text: '/stats all' },
    });
    const [first, second] = replies(ctx);
    expect(first).toBe('core stats');
    expect(second).toContain('продуктовые метрики');
    expect(second).toContain('Запас фраз канала');
    expect(second).toContain('pool down');
  });

  it('упал весь продуктовый отчёт — ядро и запас фраз всё равно доехали', async () => {
    const { service, fakeBot } = makeDeps({
      adminStatsService: {
        getAdminStats: jest.fn().mockResolvedValue('core stats'),
      },
      statsReport: { render: jest.fn().mockRejectedValue(new Error('x')) },
    });
    service.onModuleInit();
    const ctx = await runCommand(fakeBot, 'stats', {
      from: { id: 999 },
      message: { text: '/stats all' },
    });
    const [first, second] = replies(ctx);
    expect(first).toBe('core stats');
    expect(second).toContain('Остальной отчёт');
    expect(second).toContain('Здоровый Взрослый');
  });

  it('отказ самого Telegram (reply падает) по-прежнему не роняет хендлер', async () => {
    const { service, fakeBot } = makeDeps();
    service.onModuleInit();
    const ctx = await runCommand(fakeBot, 'stats', {
      from: { id: 999 },
      message: { text: '/stats all' },
      reply: jest
        .fn()
        .mockRejectedValueOnce(new Error('tg down'))
        .mockResolvedValue(undefined),
    });
    expect(replies(ctx).some((r) => r.includes('tg down'))).toBe(true);
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
    const ctx = await runCommand(fakeBot, 'stats', {
      from: { id: 999 },
      message: { text: '/stats all' },
    });
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

  it('отчёт перерос лимит Telegram — уезжает частями, а не падает целиком', async () => {
    // Шов, ради которого появился replyLong: блоки в отчёт добавляются
    // регулярно, и раньше семнадцатый мог уронить ВЕСЬ /stats одним 400 от
    // Telegram — админ увидел бы «❌», а не цифры.
    process.env.ADMIN_ID = '999';
    const long = Array.from(
      { length: 60 },
      (_, i) => `<b>Блок ${i}</b>\n${'ц'.repeat(200)}`,
    ).join('\n\n');
    const { service, fakeBot } = makeDeps({
      adminStatsService: { getAdminStats: jest.fn().mockResolvedValue('core') },
      statsReport: { render: jest.fn().mockResolvedValue(long) },
    });
    service.onModuleInit();

    const ctx = await runCommand(fakeBot, 'stats', {
      from: { id: 999 },
      message: { text: '/stats all' },
    });

    const calls = (ctx.reply as jest.Mock).mock.calls;
    expect(calls.length).toBeGreaterThan(2);
    for (const [text] of calls) {
      expect(text.length).toBeLessThanOrEqual(4096);
      // Оборванный тег Telegram отвергает целиком — тогда часть отчёта
      // пропала бы молча.
      expect(text.split('<').length).toBe(text.split('>').length);
    }
    expect(calls.map(([t]) => t).join('')).toContain('Блок 59');
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

  // Аудит 2026-10: отказ Telegram (чаще всего — URL кнопки) только писался в
  // лог, админ не видел ничего — а превью нужно ровно затем, чтобы увидеть отказ.
  it('Telegram отклонил превью — админ получает причину, а не тишину', async () => {
    process.env.ADMIN_ID = '999';
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { service, fakeBot } = makeDeps();
    service.onModuleInit();
    let call = 0;
    const reply = jest.fn(() =>
      ++call === 1
        ? Promise.reject(
            Object.assign(new Error('400: Bad Request'), {
              response: { error_code: 400, description: 'BUTTON_URL_INVALID' },
            }),
          )
        : Promise.resolve(undefined),
    );
    const ctx = await runCommand(fakeBot, 'testdonate', {
      from: { id: 999 },
      reply,
    });
    expect(ctx.reply).toHaveBeenCalledTimes(2);
    expect(ctx.reply).toHaveBeenLastCalledWith(
      '❌ Превью не отправилось: 400: BUTTON_URL_INVALID',
    );
  });
});

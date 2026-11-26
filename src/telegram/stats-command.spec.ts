import { Logger } from '@nestjs/common';
import { registerStatsHandlers } from './stats-command';
import { TELEGRAM_LIMIT } from './send-long-text';
import { statsKeyboard } from '../bot/stats-sections';
import {
  makeFakeBot,
  runAction,
  runCommand,
  hasNoActionMatch,
} from './telegram.test-helpers.spec';

const OLD_ADMIN_ID = process.env.ADMIN_ID;
const ADMIN = { id: 999 };

function setup(over: { sectionText?: string } = {}) {
  const adminStats = { getAdminStats: jest.fn().mockResolvedValue('core') };
  const statsReport = {
    render: jest.fn().mockResolvedValue('весь отчёт'),
    renderSection: jest
      .fn()
      .mockResolvedValue(over.sectionText ?? '<b>📱 Продукт</b>\n\nцифры'),
  };
  const healthyAdult = {
    poolStatus: jest
      .fn()
      .mockResolvedValue({ enabled: 0, unused: 0, daysLeft: 0 }),
  };
  const logger = { warn: jest.fn(), error: jest.fn() };
  const fakeBot = makeFakeBot();
  registerStatsHandlers(
    fakeBot.bot,
    { adminStats, statsReport, healthyAdult } as never,
    logger,
  );
  return { fakeBot, adminStats, statsReport, healthyAdult, logger };
}

beforeEach(() => {
  process.env.ADMIN_ID = '999';
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  jest.restoreAllMocks();
  if (OLD_ADMIN_ID === undefined) delete process.env.ADMIN_ID;
  else process.env.ADMIN_ID = OLD_ADMIN_ID;
});

describe('/stats', () => {
  it('одно сообщение: главные цифры и клавиатура разделов, отчёт не считается', async () => {
    const { fakeBot, statsReport } = setup();
    const ctx = await runCommand(fakeBot, 'stats', {
      from: ADMIN,
      message: { text: '/stats' },
    });
    expect(ctx.reply).toHaveBeenCalledTimes(1);
    expect(ctx.reply).toHaveBeenCalledWith('core', {
      parse_mode: 'HTML',
      reply_markup: statsKeyboard(),
    });
    expect(statsReport.render).not.toHaveBeenCalled();
    expect(statsReport.renderSection).not.toHaveBeenCalled();
  });

  it('/stats all — старое поведение: два сообщения без клавиатуры', async () => {
    const { fakeBot, statsReport } = setup();
    const ctx = await runCommand(fakeBot, 'stats', {
      from: ADMIN,
      message: { text: '/stats all' },
    });
    expect(statsReport.render).toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledTimes(2);
    expect(ctx.reply).toHaveBeenNthCalledWith(1, 'core', {
      parse_mode: 'HTML',
    });
    expect(String(ctx.reply.mock.calls[1][0])).toContain('весь отчёт');
  });

  it('/stats@bot all тоже полный отчёт', async () => {
    const { fakeBot } = setup();
    const ctx = await runCommand(fakeBot, 'stats', {
      from: ADMIN,
      message: { text: '/stats@schema_bot all' },
    });
    expect(ctx.reply).toHaveBeenCalledTimes(2);
    expect(ctx.reply).toHaveBeenNthCalledWith(1, 'core', {
      parse_mode: 'HTML',
    });
    expect(String(ctx.reply.mock.calls[1][0])).toContain('весь отчёт');
  });

  it('не-админ отбит, метрики не запрашиваются', async () => {
    const { fakeBot, adminStats } = setup();
    const ctx = await runCommand(fakeBot, 'stats', {
      from: { id: 1 },
      message: { text: '/stats' },
    });
    expect(ctx.reply).toHaveBeenCalledWith('⛔ Нет доступа');
    expect(adminStats.getAdminStats).not.toHaveBeenCalled();
  });

  it('падение getAdminStats: на экране заглушка, клавиатура на месте', async () => {
    const { fakeBot, adminStats } = setup();
    adminStats.getAdminStats.mockRejectedValue(new Error('db down'));
    const ctx = await runCommand(fakeBot, 'stats', {
      from: ADMIN,
      message: { text: '/stats' },
    });
    const [text, extra] = ctx.reply.mock.calls[0];
    expect(text).toContain('db down');
    expect(extra.reply_markup).toEqual(statsKeyboard());
  });

  it('сбой отправки: логирует и отвечает «❌»', async () => {
    const { fakeBot, logger } = setup();
    const ctx = await runCommand(fakeBot, 'stats', {
      from: ADMIN,
      message: { text: '/stats' },
      reply: jest
        .fn()
        .mockRejectedValueOnce(new Error('tg down'))
        .mockResolvedValue(undefined),
    });
    expect(logger.error).toHaveBeenCalled();
    expect(String(ctx.reply.mock.calls[1][0])).toContain('tg down');
  });
});

describe('stats:<раздел>', () => {
  it('раздел редактирует сообщение и ставит клавиатуру «← Главное»', async () => {
    const { fakeBot, statsReport } = setup();
    const ctx = await runAction(fakeBot, 'stats:product', { from: ADMIN });
    expect(ctx.answerCbQuery).toHaveBeenCalledTimes(1);
    expect(statsReport.renderSection).toHaveBeenCalledWith('product');
    expect(ctx.editMessageText).toHaveBeenCalledWith(
      '<b>📱 Продукт</b>\n\nцифры',
      { parse_mode: 'HTML', reply_markup: statsKeyboard('product') },
    );
    expect(ctx.reply).not.toHaveBeenCalled();
  });

  it('system: дописывает здоровье системы и запас фраз', async () => {
    const { fakeBot, healthyAdult } = setup();
    const ctx = await runAction(fakeBot, 'stats:system', { from: ADMIN });
    expect(healthyAdult.poolStatus).toHaveBeenCalled();
    const text = ctx.editMessageText.mock.calls[0][0] as string;
    expect(text).toContain('Здоровый Взрослый');
    expect(text).toContain('цифры');
  });

  it('неизвестный раздел: «Нет такого раздела», ничего не считается', async () => {
    const { fakeBot, statsReport, adminStats } = setup();
    const ctx = await runAction(fakeBot, 'stats:nope', { from: ADMIN });
    expect(ctx.answerCbQuery).toHaveBeenCalledWith('Нет такого раздела');
    expect(statsReport.renderSection).not.toHaveBeenCalled();
    expect(adminStats.getAdminStats).not.toHaveBeenCalled();
    expect(ctx.editMessageText).not.toHaveBeenCalled();
  });

  it('не-админ: «Нет доступа», одно подтверждение, метрики не считаются', async () => {
    const { fakeBot, statsReport } = setup();
    const ctx = await runAction(fakeBot, 'stats:product', {
      from: { id: 1 },
    });
    expect(ctx.answerCbQuery).toHaveBeenCalledTimes(1);
    expect(ctx.answerCbQuery).toHaveBeenCalledWith('⛔ Нет доступа');
    expect(statsReport.renderSection).not.toHaveBeenCalled();
  });

  it('stats:main возвращает главные цифры с клавиатурой разделов', async () => {
    const { fakeBot } = setup();
    const ctx = await runAction(fakeBot, 'stats:main', { from: ADMIN });
    expect(ctx.editMessageText).toHaveBeenCalledWith('core', {
      parse_mode: 'HTML',
      reply_markup: statsKeyboard(),
    });
  });

  it('stats:all шлёт полный отчёт отдельными сообщениями, не редактируя', async () => {
    const { fakeBot, statsReport } = setup();
    const ctx = await runAction(fakeBot, 'stats:all', { from: ADMIN });
    expect(statsReport.render).toHaveBeenCalled();
    expect(ctx.editMessageText).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledTimes(2);
    expect(ctx.reply).toHaveBeenNthCalledWith(1, 'core', {
      parse_mode: 'HTML',
    });
    expect(String(ctx.reply.mock.calls[1][0])).toContain('весь отчёт');
  });

  it('длинный раздел: первый кусок редактированием, остальные reply, клавиатура на последнем', async () => {
    const line = 'x'.repeat(99) + '\n';
    const { fakeBot } = setup({ sectionText: line.repeat(90) }); // ~9000
    const ctx = await runAction(fakeBot, 'stats:product', { from: ADMIN });
    const edit = ctx.editMessageText.mock.calls;
    const replies = ctx.reply.mock.calls;
    expect(edit).toHaveLength(1);
    expect(replies.length).toBeGreaterThanOrEqual(2);
    expect(edit[0][1].reply_markup).toBeUndefined();
    expect(replies[0][1].reply_markup).toBeUndefined();
    expect(replies[replies.length - 1][1].reply_markup).toEqual(
      statsKeyboard('product'),
    );
    for (const text of [edit[0][0], ...replies.map((c: any[]) => c[0])]) {
      expect(text.length).toBeLessThanOrEqual(TELEGRAM_LIMIT);
    }
  });

  it('«message is not modified» глушится, прочие сбои — в лог и «❌»', async () => {
    const { fakeBot, logger } = setup();
    const same = await runAction(fakeBot, 'stats:product', {
      from: ADMIN,
      editMessageText: jest
        .fn()
        .mockRejectedValue(
          new Error('400: Bad Request: message is not modified'),
        ),
    });
    expect(logger.error).not.toHaveBeenCalled();
    expect(same.reply).not.toHaveBeenCalled();

    const broken = await runAction(fakeBot, 'stats:product', {
      from: ADMIN,
      editMessageText: jest.fn().mockRejectedValue(new Error('boom')),
    });
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(String(broken.reply.mock.calls[0][0])).toContain('boom');
  });

  it('regex хендлера не ловит чужие callback_data', () => {
    const { fakeBot } = setup();
    expect(hasNoActionMatch(fakeBot, 'stats:Product')).toBe(true);
    expect(hasNoActionMatch(fakeBot, 'stats:a:b')).toBe(true);
    expect(hasNoActionMatch(fakeBot, 'stats:money')).toBe(false);
  });
});

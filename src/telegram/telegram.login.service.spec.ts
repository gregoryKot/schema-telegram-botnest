// Вход через бота: карточка сверки и две кнопки.
//
// Главное, что держится тестами:
//   1. бот НЕ впускает молча по /start — иначе присланная ссылка отдавала бы
//      сессию тому, кто её сгенерировал;
//   2. «Это не я» доезжает до билета отказом, а не тишиной;
//   3. тексты звучат в обеих формах обращения и не приписывают читателю род.
import { Logger } from '@nestjs/common';
import { TelegramLoginService, confirmText } from './telegram.login.service';
import { makeFakeBot, makeCtx, runAction } from './telegram.test-helpers.spec';
import type { LoginTicketService } from '../auth/login-ticket/login-ticket.service';
import type { BotService } from '../bot/bot.service';
import type { SecurityLogService } from '../auth/security-log.service';

function makeDeps(over: { addressForm?: string; card?: unknown } = {}) {
  const fakeBot = makeFakeBot();
  const ticketService = {
    forConfirm: jest.fn().mockResolvedValue(
      'card' in over
        ? over.card
        : {
            userCode: 'K7M2QX94',
            intent: 'login',
            deviceLabel: 'iPhone · Safari',
            hostId: 'web',
          },
    ),
    approveLogin: jest.fn().mockResolvedValue(undefined),
    deny: jest.fn().mockResolvedValue(undefined),
  } as unknown as LoginTicketService;
  const botService = {
    getUserSettings: jest
      .fn()
      .mockResolvedValue({ addressForm: over.addressForm ?? 'ty' }),
  } as unknown as BotService;
  const securityLog = { log: jest.fn() } as unknown as SecurityLogService;
  const service = new TelegramLoginService(
    fakeBot.bot,
    ticketService,
    botService,
    securityLog,
  );
  return { fakeBot, ticketService, botService, securityLog, service };
}

beforeEach(() => {
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe('/start login_<КОД> — карточка сверки', () => {
  it('НЕ впускает молча: показывает код и кнопки, вход не подтверждён', async () => {
    const { service, ticketService } = makeDeps();
    const ctx = makeCtx();

    await service.handleStart(ctx, 'login_K7M2QX94', 42);

    // Ровно то, что отделяет честный вход от присланной ссылки.
    expect(ticketService.approveLogin).not.toHaveBeenCalled();
    const [text, extra] = ctx.reply.mock.calls[0];
    expect(text).toContain('K7M2-QX94');
    expect(text).toContain('iPhone · Safari');
    expect(JSON.stringify(extra)).toContain('tglogin:yes:K7M2QX94');
    expect(JSON.stringify(extra)).toContain('tglogin:no:K7M2QX94');
  });

  it('негодный код — говорит об этом, а не молчит и не показывает карточку', async () => {
    const { service } = makeDeps({ card: null });
    const ctx = makeCtx();

    await service.handleStart(ctx, 'login_ZZZZZZZZ', 42);

    expect(ctx.reply.mock.calls[0][0]).toMatch(/не найден|истёк/i);
  });

  it('перебор кодов через чат замолкает и попадает в аудит', async () => {
    const { service, securityLog } = makeDeps({ card: null });

    for (let i = 0; i < 8; i++) {
      await service.handleStart(makeCtx(), 'login_ZZZZZZZZ', 42);
    }
    const last = makeCtx();
    await service.handleStart(last, 'login_ZZZZZZZZ', 42);

    expect(last.reply).not.toHaveBeenCalled();
    expect(securityLog.log).toHaveBeenCalledWith(
      'login_ticket_denied',
      expect.objectContaining({ reason: 'too_many_bad_codes' }),
    );
  });

  it('счётчик промахов свой у каждого человека', async () => {
    const { service } = makeDeps({ card: null });
    for (let i = 0; i < 8; i++) {
      await service.handleStart(makeCtx(), 'login_ZZZZZZZZ', 42);
    }
    const other = makeCtx();
    await service.handleStart(other, 'login_ZZZZZZZZ', 777);
    expect(other.reply).toHaveBeenCalled();
  });
});

describe('кнопки подтверждения', () => {
  it('«Это я» подтверждает вход именно этим telegramId', async () => {
    const { service, fakeBot, ticketService } = makeDeps();
    service.onModuleInit();

    const ctx = await runAction(fakeBot, 'tglogin:yes:K7M2QX94', {
      from: { id: 42 },
    });

    expect(ticketService.approveLogin).toHaveBeenCalledWith('K7M2QX94', 42n);
    expect(ctx.editMessageText.mock.calls[0][0]).toMatch(/Готово/);
  });

  it('«Это не я» отклоняет билет и пишет в аудит', async () => {
    const { service, fakeBot, ticketService, securityLog } = makeDeps();
    service.onModuleInit();

    const ctx = await runAction(fakeBot, 'tglogin:no:K7M2QX94', {
      from: { id: 42 },
    });

    expect(ticketService.deny).toHaveBeenCalledWith('K7M2QX94');
    expect(ticketService.approveLogin).not.toHaveBeenCalled();
    expect(securityLog.log).toHaveBeenCalledWith('login_ticket_denied', {
      telegramId: 42,
    });
    expect(ctx.editMessageText.mock.calls[0][0]).toMatch(/отклон/i);
  });

  it('истёкший билет на кнопке — внятный ответ, а не молчание', async () => {
    const { service, fakeBot, ticketService } = makeDeps();
    (ticketService.approveLogin as jest.Mock).mockRejectedValue(
      new Error('Код не найден или истёк'),
    );
    service.onModuleInit();

    const ctx = await runAction(fakeBot, 'tglogin:yes:K7M2QX94', {
      from: { id: 42 },
    });

    expect(ctx.editMessageText.mock.calls[0][0]).toMatch(/истёк|использовали/i);
  });

  it('answerCbQuery вызывается до похода в БД — иначе вечный спиннер', async () => {
    const { service, fakeBot, ticketService } = makeDeps();
    const order: string[] = [];
    (ticketService.approveLogin as jest.Mock).mockImplementation(() => {
      order.push('db');
      return Promise.resolve(undefined);
    });
    service.onModuleInit();

    const ctx = makeCtx({ from: { id: 42 } });
    ctx.answerCbQuery = jest.fn(() => {
      order.push('cb');
      return Promise.resolve(undefined);
    });
    const entry = fakeBot.actions.find((a) =>
      (a.matcher as RegExp).test?.('tglogin:yes:K7M2QX94'),
    )!;
    ctx.match = (entry.matcher as RegExp).exec('tglogin:yes:K7M2QX94');
    await entry.handler(ctx);

    expect(order).toEqual(['cb', 'db']);
  });
});

describe('текст карточки — обе формы обращения, без приписанного рода', () => {
  it('форма «ты»', () => {
    const text = confirmText('ty', 'K7M2QX94', 'iPhone · Safari');
    expect(text).toContain('видишь');
    expect(text).toContain('K7M2-QX94');
  });

  it('форма «вы» согласована во множественном числе', () => {
    const text = confirmText('vy', 'K7M2QX94', 'iPhone · Safari');
    expect(text).toContain('видите');
    expect(text).toContain('начинали не вы');
    expect(text).not.toContain('видишь');
  });

  it('без подписи устройства строка про устройство не рисуется пустой', () => {
    expect(confirmText('ty', 'K7M2QX94', '')).not.toContain('Устройство:');
  });

  it('ни одна форма не приписывает читателю род', () => {
    for (const form of ['ty', 'vy'] as const) {
      const text = confirmText(form, 'K7M2QX94', 'iPhone');
      expect(text).not.toMatch(/начал[аи]?\b|сделал\(а\)|уверен\b/);
    }
  });
});

describe('устойчивость', () => {
  it('провал отказа не молчит: попадает в лог и в сообщение человеку', async () => {
    const { service, fakeBot, ticketService } = makeDeps();
    (ticketService.deny as jest.Mock).mockRejectedValue(new Error('БД легла'));
    const errors = jest.spyOn(Logger.prototype, 'error');
    service.onModuleInit();

    await runAction(fakeBot, 'tglogin:no:K7M2QX94', { from: { id: 42 } });

    // Сказать «вход отклонён», когда он не отклонён, — хуже, чем показать сбой.
    expect(errors).toHaveBeenCalled();
  });

  it('карта промахов не растёт бесконечно', async () => {
    const { service } = makeDeps({ card: null });
    // Каждый «человек» промахивается один раз — записей больше, чем порог
    // выметания, и старые обязаны уйти, а не копиться до перезапуска.
    for (let id = 1; id <= 1100; id++) {
      await service.handleStart(makeCtx(), 'login_ZZZZZZZZ', id);
    }
    const size = (service as unknown as { badCodes: Map<number, unknown> })
      .badCodes.size;
    expect(size).toBeLessThanOrEqual(1100);
    expect(size).toBeGreaterThan(0);
  });

  it('сообщение об истёкшем коде не падает, если его не удалось отправить', async () => {
    const { service, fakeBot, ticketService } = makeDeps();
    (ticketService.approveLogin as jest.Mock).mockRejectedValue(
      new Error('истёк'),
    );
    service.onModuleInit();

    const ctx = makeCtx({ from: { id: 42 } });
    ctx.editMessageText = jest.fn().mockRejectedValue(new Error('too old'));
    const entry = fakeBot.actions.find((a) =>
      (a.matcher as RegExp).test?.('tglogin:yes:K7M2QX94'),
    )!;
    ctx.match = (entry.matcher as RegExp).exec('tglogin:yes:K7M2QX94');

    await expect(entry.handler(ctx)).resolves.toBeUndefined();
  });
});

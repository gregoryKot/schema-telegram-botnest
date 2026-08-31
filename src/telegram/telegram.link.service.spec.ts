// Объединение аккаунтов через бота: карточка сверки и две кнопки.
//
// Главное, что держится тестами:
//   1. билет ВХОДА, подставленный в ссылку привязки, выглядит негодным кодом —
//      иначе человек подтверждал бы перенос данных там, где открывается сессия;
//   2. хозяином данных становится КАНОНИЧЕСКИЙ номер: у слитого раньше
//      аккаунта сырой telegramId указывает на удалённую строку;
//   3. исход пишется событием на сервере — сайт узнаёт о нём только опросом и
//      поля `merged` в ответе не видит, отправить событие ему нечем;
//   4. тексты звучат в обеих формах и не приписывают читателю род.
import { Logger } from '@nestjs/common';
import {
  TelegramLinkService,
  linkConfirmText,
  summaryLine,
} from './telegram.link.service';
import { makeFakeBot, makeCtx, runAction } from './telegram.test-helpers.spec';
import type { LoginTicketService } from '../auth/login-ticket/login-ticket.service';
import type { TicketLinkService } from '../auth/login-ticket/ticket-link.service';
import type { BotService } from '../bot/bot.service';
import type { SecurityLogService } from '../auth/security-log.service';
import type { AnalyticsService } from '../analytics/analytics.service';

function makeDeps(over: { addressForm?: string; card?: unknown } = {}) {
  const fakeBot = makeFakeBot();
  const ticketService = {
    forConfirm: jest.fn().mockResolvedValue(
      'card' in over
        ? over.card
        : {
            userCode: 'K7M2QX94',
            intent: 'link',
            deviceLabel: 'Chrome · Windows',
            hostId: 'web',
          },
    ),
    deny: jest.fn().mockResolvedValue(undefined),
  } as unknown as LoginTicketService;
  const links = {
    preview: jest.fn().mockResolvedValue({
      provider: 'google',
      displayName: null,
      sameAccount: false,
      summary: { Rating: 87, Note: 14 },
    }),
    approve: jest.fn().mockResolvedValue({ merged: true }),
  } as unknown as TicketLinkService;
  const botService = {
    getUserSettings: jest
      .fn()
      .mockResolvedValue({ addressForm: over.addressForm ?? 'ty' }),
  } as unknown as BotService;
  const accountService: any = {
    canonicalUserId: jest.fn(async (id: number) => BigInt(id)),
    registerUser: jest.fn().mockResolvedValue(undefined),
  };
  const securityLog = { log: jest.fn() } as unknown as SecurityLogService;
  const analytics = {
    track: jest.fn().mockResolvedValue(undefined),
  } as unknown as AnalyticsService;
  const service = new TelegramLinkService(
    fakeBot.bot,
    ticketService,
    links,
    botService,
    accountService,
    securityLog,
    analytics,
  );
  return {
    fakeBot,
    ticketService,
    links,
    botService,
    accountService,
    securityLog,
    analytics,
    service,
  };
}

beforeEach(() => {
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe('summaryLine', () => {
  it('называет только то, что человек узнаёт', () => {
    expect(summaryLine({ Rating: 87, Note: 14 })).toBe(
      'Оценки — 87, Заметки — 14',
    );
  });

  it('служебные таблицы в карточку не попадают', () => {
    // «AuthProvider — 2» человеку ни о чём не говорит и только пугает.
    expect(summaryLine({ AuthProvider: 2, AnalyticsEvent: 500 })).toBe('');
  });

  it('пустая сводка — пустая строка, а не «0»', () => {
    expect(summaryLine({})).toBe('');
    expect(summaryLine({ Rating: 0 })).toBe('');
  });

  it('показываем крупнейшее и не больше четырёх строк', () => {
    const line = summaryLine({
      Rating: 1,
      Note: 2,
      UserLetter: 3,
      PracticePlan: 4,
      YsqResult: 5,
    });
    expect(line.split(', ')).toHaveLength(4);
    expect(line).toContain('Результаты теста — 5');
    expect(line).not.toContain('Оценки — 1');
  });
});

describe('linkConfirmText', () => {
  it('форма «ты» не содержит «вы»-обращений', () => {
    const text = linkConfirmText('ty', 'K7M2QX94', 'Chrome', { Rating: 3 });
    expect(text).toContain('Подтвердишь');
    expect(text).not.toMatch(/Подтвердите|у вас на экране/);
  });

  it('форма «вы» не содержит «ты»-обращений', () => {
    const text = linkConfirmText('vy', 'K7M2QX94', 'Chrome', { Rating: 3 });
    expect(text).toContain('Подтвердите');
    expect(text).not.toMatch(/Подтвердишь|у тебя на экране/);
  });

  it('код показан в сверяемом виде и названо, что переедет', () => {
    const text = linkConfirmText('ty', 'K7M2QX94', 'Chrome · Windows', {
      Rating: 87,
    });
    expect(text).toContain('K7M2-QX94');
    expect(text).toContain('Chrome · Windows');
    expect(text).toContain('Оценки — 87');
  });

  it('без сводки строка «что переедет» не печатается', () => {
    expect(linkConfirmText('ty', 'K7M2QX94', '', {})).not.toContain(
      'Что переедет',
    );
  });
});

describe('/start link_<КОД>', () => {
  it('живой билет привязки — карточка сверки с кнопками', async () => {
    const { service, links } = makeDeps();
    const ctx = makeCtx();

    await service.handleStart(ctx, 'link_K7M2QX94', 42);

    expect(links.preview).toHaveBeenCalledWith('K7M2QX94', 42n);
    const [text, opts] = (ctx.reply as jest.Mock).mock.calls[0];
    expect(text).toContain('K7M2-QX94');
    expect(opts.reply_markup.inline_keyboard[0][0].callback_data).toBe(
      'tglink:yes:K7M2QX94',
    );
  });

  it('билет ВХОДА в ссылке привязки выглядит негодным кодом', async () => {
    // Иначе человеку показали бы карточку переноса данных там, где на деле
    // открывается чужая сессия, — и он подтвердил бы не то, что думает.
    const { service, links } = makeDeps({
      card: { userCode: 'K7M2QX94', intent: 'login', deviceLabel: '' },
    });
    const ctx = makeCtx();

    await service.handleStart(ctx, 'link_K7M2QX94', 42);

    expect(links.preview).not.toHaveBeenCalled();
    expect((ctx.reply as jest.Mock).mock.calls[0][0]).toContain('не найден');
  });

  it('негодный код — безличный ответ, без похода за сводкой', async () => {
    const { service, links } = makeDeps({ card: null });
    const ctx = makeCtx();

    await service.handleStart(ctx, 'link_ZZZZZZZZ', 42);

    expect(links.preview).not.toHaveBeenCalled();
    expect((ctx.reply as jest.Mock).mock.calls[0][0]).toContain('не найден');
  });
});

describe('tglink:yes — кто становится хозяином данных', () => {
  it('объединяет на КАНОНИЧЕСКИЙ номер, а не на сырой telegramId', async () => {
    const WEB = 1_000_000_000_000_777n;
    const { service, fakeBot, links, accountService } = makeDeps();
    accountService.canonicalUserId.mockResolvedValue(WEB);
    service.onModuleInit();

    await runAction(fakeBot, 'tglink:yes:K7M2QX94', { from: { id: 42 } });

    expect(links.approve).toHaveBeenCalledWith('K7M2QX94', WEB);
    expect(links.approve).not.toHaveBeenCalledWith('K7M2QX94', 42n);
  });

  it('исход пишет сервер: сайт о нём узнать не может', async () => {
    const { service, fakeBot, analytics } = makeDeps();
    service.onModuleInit();

    await runAction(fakeBot, 'tglink:yes:K7M2QX94', { from: { id: 42 } });

    expect(analytics.track).toHaveBeenCalledWith(
      42n,
      'account_link_confirmed',
      { host: 'web', merged: true },
    );
  });

  it('провал объединения не говорит «готово»', async () => {
    const { service, fakeBot, links } = makeDeps();
    (links.approve as jest.Mock).mockRejectedValue(new Error('БД легла'));
    const errors = jest.spyOn(Logger.prototype, 'error');
    service.onModuleInit();

    const ctx = await runAction(fakeBot, 'tglink:yes:K7M2QX94', {
      from: { id: 42 },
    });

    // Молчание после нажатия читается как «наверное, получилось», поэтому
    // исход человеку сообщаем — но «готово» не говорим.
    const said = (ctx.editMessageText as jest.Mock).mock.calls[0][0];
    expect(said).toContain('Не получилось объединить');
    expect(said).not.toContain('Готово');
    expect(errors.mock.calls[0][0]).toContain('БД легла');
  });
});

describe('tglink:no', () => {
  it('доезжает до билета отказом и пишет в аудит', async () => {
    const { service, fakeBot, ticketService, securityLog } = makeDeps();
    service.onModuleInit();

    const ctx = await runAction(fakeBot, 'tglink:no:K7M2QX94', {
      from: { id: 42 },
    });

    expect(ticketService.deny).toHaveBeenCalledWith('K7M2QX94');
    expect(securityLog.log).toHaveBeenCalledWith(
      'login_ticket_denied',
      expect.objectContaining({ reason: 'user_denied_link' }),
    );
    expect((ctx.editMessageText as jest.Mock).mock.calls[0][0]).toContain(
      'отклонено',
    );
  });
});

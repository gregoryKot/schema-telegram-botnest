// /zayavki (фолбэк-доступ к заявкам терапевта) и /broadcast (массовая
// рассылка админа) на TelegramAdminService. Перенесено из
// telegram.service.broadcast.spec.ts при выносе админ-хендлеров в отдельный
// сервис (правило №10 CLAUDE.md — лимит размера файла). /zv, /stats,
// /testdonate — telegram.admin.service.spec.ts; treq —
// telegram.admin.service.treq.spec.ts.
import { Logger } from '@nestjs/common';
import { TelegramAdminService } from './telegram.admin.service';
import { makeFakeBot, runCommand } from './telegram.test-helpers.spec';
import { AccountService } from '../bot/account.service';
import { createFakeTable } from '../test-support/fake-prisma.spec-helper';

const OLD_ADMIN_ID = process.env.ADMIN_ID;

function makeDeps(overrides: Record<string, any> = {}) {
  const adminStatsService = { ...overrides.adminStatsService };
  const statsReport = { ...overrides.statsReport };
  const healthyAdultService = { ...overrides.healthyAdultService };
  const accountService = {
    getBroadcastUserIds: jest.fn().mockResolvedValue([]),
    markUserBlocked: jest.fn().mockResolvedValue(undefined),
    // Адрес в Telegram по умолчанию равен userId — так выглядит пользователь
    // бота без отдельного веб-входа. Спек, которому нужен другой расклад
    // (слитый аккаунт, веб-only), переопределяет это через overrides.
    telegramIdsFor: jest.fn((ids: bigint[]) =>
      Promise.resolve(new Map(ids.map((id) => [String(id), id]))),
    ),
    ...overrides.accountService,
  };
  const therapistRequestService = {
    listPending: jest.fn().mockResolvedValue([]),
    ...overrides.therapistRequestService,
  };
  const publisher = { ...overrides.publisher };
  const channelCheck = { ...overrides.channelCheck };
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

describe('TelegramAdminService — /zayavki (только админ, фолбэк-доступ к заявкам)', () => {
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

describe('TelegramAdminService — /broadcast (только админ)', () => {
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
        getBroadcastUserIds: jest.fn().mockResolvedValue([1n, 2n]),
      },
    });
    service.onModuleInit();
    // Рассылка шлёт через sendBounded (callApi с сигналом отмены, #681).
    const callApi = fakeBot.telegram.callApi;
    callApi
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce({ response: { error_code: 403 } });
    const ctx = await runCommand(fakeBot, 'broadcast', {
      from: { id: 999 },
      message: { text: '/broadcast всем привет' },
    });
    expect(callApi).toHaveBeenCalledWith(
      'sendMessage',
      { chat_id: 1, text: 'всем привет', parse_mode: undefined },
      expect.objectContaining({ signal: expect.anything() }),
    );
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
        getBroadcastUserIds: jest.fn().mockResolvedValue([2n]),
        markUserBlocked: jest.fn().mockRejectedValue(dbError),
      },
    });
    service.onModuleInit();
    const warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    fakeBot.telegram.callApi.mockRejectedValueOnce({
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

// Шов рассылки (правило №14): настоящий AccountService над фейковой Prisma,
// а не мок telegramIdsFor «id -> id». Раньше путь «веб-номер + привязка
// AuthProvider -> chat_id» в рассылке тестом не проходился, а между базой и
// отправкой userId дважды превращался Number -> BigInt (аудит 2026-10, X-1).
describe('TelegramAdminService — /broadcast на настоящем AccountService', () => {
  const OLD_BOT_ID = 42n; // старый пользователь бота: номер == chat_id
  const WEB_LINKED = 1_234_567_890_123_457n; // веб-номер + Telegram '555'
  const WEB_ONLY = 2_000_000_000_000_001n; // веб-номер без привязки
  const ABOVE_2_53 = 2n ** 53n + 1n; // Number() даёт ...992 — другой человек

  function makeReal() {
    const user = createFakeTable(
      [OLD_BOT_ID, WEB_LINKED, WEB_ONLY, ABOVE_2_53].map((id) => ({ id })),
    );
    user.updateMany.mockImplementation(() => ({ count: 1 }));
    const authProvider = createFakeTable([
      { id: 1, provider: 'telegram', providerId: '555', userId: WEB_LINKED },
      { id: 2, provider: 'telegram', providerId: '777', userId: ABOVE_2_53 },
    ]);
    const prisma = { user, authProvider } as never;
    const real = new AccountService(prisma);
    // makeDeps разворачивает overrides спредом, а методы класса лежат на
    // прототипе — отдаём их привязанными, логика остаётся настоящей.
    const accountService = {
      getBroadcastUserIds: () => real.getBroadcastUserIds(),
      telegramIdsFor: (ids: bigint[]) => real.telegramIdsFor(ids),
      markUserBlocked: jest.fn((id: bigint) => real.markUserBlocked(id)),
    };
    return { accountService, user };
  }

  it('адресует по привязке, а не по userId; id > 2^53 не округляется; без чата — в пропущенные', async () => {
    process.env.ADMIN_ID = '999';
    const { accountService } = makeReal();
    const { service, fakeBot } = makeDeps({ accountService });
    service.onModuleInit();
    const ctx = await runCommand(fakeBot, 'broadcast', {
      from: { id: 999 },
      message: { text: '/broadcast привет' },
    });
    const sentTo = fakeBot.telegram.callApi.mock.calls.map(
      (c) => (c[1] as { chat_id: number }).chat_id,
    );
    expect(sentTo).toEqual([42, 555, 777]);
    const summary = ctx.reply.mock.calls.at(-1)![0];
    expect(summary).toContain('3 доставлено');
    expect(summary).toContain('1 без чата в Telegram');
  }, 10_000);

  it('403 у получателя с id > 2^53 — markUserBlocked получает тот же bigint', async () => {
    process.env.ADMIN_ID = '999';
    const { accountService } = makeReal();
    const { service, fakeBot } = makeDeps({ accountService });
    service.onModuleInit();
    fakeBot.telegram.callApi.mockImplementation(
      (_m: string, p: { chat_id: number }) =>
        p.chat_id === 777
          ? Promise.reject(
              Object.assign(new Error('Forbidden'), {
                response: { error_code: 403 },
              }),
            )
          : Promise.resolve(undefined),
    );
    await runCommand(fakeBot, 'broadcast', {
      from: { id: 999 },
      message: { text: '/broadcast привет' },
    });
    expect(accountService.markUserBlocked).toHaveBeenCalledTimes(1);
    expect(accountService.markUserBlocked).toHaveBeenCalledWith(ABOVE_2_53);
  }, 10_000);
});

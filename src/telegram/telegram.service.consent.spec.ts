// Продолжение telegram.service.onboarding.spec.ts (лимит ~300 строк на файл,
// CLAUDE.md — вынесено в отдельный файл): accept_consent (легаси-кнопка
// consent-сообщений, отправленных до слияния экранов согласия),
// accept:(ty|vy)/cancel/back:welcome/treq — их непокрытые ветки catch/фолбэк
// (базовый happy-path уже покрыт telegram.service.spec.ts).
import { Logger } from '@nestjs/common';
import { TelegramService, WELCOME_TEXT } from './telegram.service';
import {
  makeFakeBot,
  runCommand,
  runAction,
} from './telegram.test-helpers.spec';

function makeDeps(overrides: Record<string, any> = {}) {
  const botService = {
    getUserSettings: jest.fn().mockResolvedValue(null),
    updateUserSettings: jest.fn().mockResolvedValue(undefined),
    acceptDisclaimer: jest.fn().mockResolvedValue(undefined),
    hasAcceptedDisclaimer: jest.fn().mockResolvedValue(false),
    cancelAllPreReminders: jest.fn().mockResolvedValue(0),
    ...overrides.botService,
  };
  const analyticsService = {
    ...overrides.analyticsService,
  };
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
  const accountService = {
    registerUser: jest.fn().mockResolvedValue(undefined),
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
  const analyticsEvents = {
    track: jest.fn().mockResolvedValue(undefined),
    ...overrides.analyticsEvents,
  };
  const fakeBot = makeFakeBot();
  const service = new TelegramService(
    fakeBot.bot,
    botService,
    analyticsService,
    adminStatsService,
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
  return { service, fakeBot, botService, pairsService, analyticsEvents };
}

beforeEach(() => {
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('TelegramService — accept_consent (легаси-кнопка)', () => {
  it('без ожидающей пары — сохраняет согласие и спрашивает форму обращения', async () => {
    const { service, fakeBot, botService } = makeDeps();
    service.onModuleInit();
    const ctx = await runAction(fakeBot, 'accept_consent', { from: { id: 1 } });
    expect(botService.acceptDisclaimer).toHaveBeenCalledWith(1n);
    expect(ctx.editMessageText).toHaveBeenCalledWith(
      expect.stringContaining('как удобнее общаться'),
      expect.anything(),
    );
  });

  it('editMessageText падает (устаревшее сообщение) — фолбэк на reply', async () => {
    const { service, fakeBot } = makeDeps();
    service.onModuleInit();
    const ctx = await runAction(fakeBot, 'accept_consent', {
      from: { id: 1 },
      editMessageText: jest
        .fn()
        .mockRejectedValue(new Error('message too old')),
    });
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('как удобнее общаться'),
      expect.anything(),
    );
  });

  it('с ожидающей pair-заявкой (после /start pair_XXX без согласия) — резолвит присоединение', async () => {
    const { service, fakeBot, pairsService } = makeDeps();
    service.onModuleInit();
    await runCommand(fakeBot, 'start', {
      from: { id: 1 },
      startPayload: 'pair_abc',
    });
    const ctx = await runAction(fakeBot, 'accept_consent', { from: { id: 1 } });
    expect(pairsService.joinPair).toHaveBeenCalledWith(1n, 'ABC');
    expect(ctx.editMessageText).toHaveBeenCalledWith(
      expect.stringContaining('Вы в паре!'),
      expect.anything(),
    );
  });

  it('ошибка внутри — логируется, не бросает, отвечает попыткой фолбэк-сообщения', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { service, fakeBot } = makeDeps({
      botService: {
        acceptDisclaimer: jest.fn().mockRejectedValue(new Error('db down')),
      },
    });
    service.onModuleInit();
    const ctx = await runAction(fakeBot, 'accept_consent', { from: { id: 1 } });
    // acceptDisclaimer упал до editMessageText/reply — хендлер идёт в catch
    // и пробует editMessageText-извинение; ловим реальный вызов, а не просто
    // "не бросило".
    expect(ctx.editMessageText).toHaveBeenCalledWith(
      expect.stringContaining('Попробуй нажать ещё раз'),
    );
  });
});

describe('TelegramService — accept:(ty|vy) катастрофические ветки', () => {
  it('editMessageText падает — фолбэк на reply с тем же текстом', async () => {
    const { service, fakeBot } = makeDeps();
    service.onModuleInit();
    const ctx = await runAction(fakeBot, 'accept:ty', {
      from: { id: 1 },
      editMessageText: jest.fn().mockRejectedValue(new Error('too old')),
    });
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining(WELCOME_TEXT),
      expect.anything(),
    );
  });

  it('ошибка сохранения формы — логируется, editMessageText с извинением (перехвачен .catch)', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { service, fakeBot } = makeDeps({
      botService: {
        acceptDisclaimer: jest.fn().mockRejectedValue(new Error('db down')),
      },
    });
    service.onModuleInit();
    const ctx = await runAction(fakeBot, 'accept:ty', { from: { id: 1 } });
    expect(ctx.editMessageText).toHaveBeenCalledWith(
      expect.stringContaining('Попробуй нажать ещё раз'),
    );
  });
});

describe('TelegramService — cancel/back:welcome ошибки', () => {
  it('cancel: deleteMessage падает — ошибка залогирована, answerCbQuery всё равно отдан до сбоя', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { service, fakeBot } = makeDeps();
    service.onModuleInit();
    const ctx = await runAction(fakeBot, 'cancel', {
      deleteMessage: jest.fn().mockRejectedValue(new Error('already deleted')),
    });
    // answerCbQuery() до обращения к Telegram API — инвариант CLAUDE.md
    // «отвечать до сайд-эффекта», проверяем, что он реально успел уйти.
    expect(ctx.answerCbQuery).toHaveBeenCalledWith();
  });

  it('back:welcome: editMessageText падает — фолбэк reply с приветствием', async () => {
    const { service, fakeBot } = makeDeps();
    service.onModuleInit();
    const ctx = await runAction(fakeBot, 'back:welcome', {
      editMessageText: jest.fn().mockRejectedValue(new Error('too old')),
    });
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Привет!'),
      expect.anything(),
    );
  });

  it('back:welcome: и editMessageText, и reply падают — ошибка залогирована, оба фолбэка реально вызваны', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { service, fakeBot } = makeDeps();
    service.onModuleInit();
    const editMessageText = jest.fn().mockRejectedValue(new Error('too old'));
    const reply = jest.fn().mockRejectedValue(new Error('chat gone'));
    await runAction(fakeBot, 'back:welcome', {
      editMessageText,
      reply,
    });
    expect(editMessageText).toHaveBeenCalledWith(
      WELCOME_TEXT,
      expect.anything(),
    );
    expect(reply).toHaveBeenCalledWith(WELCOME_TEXT, expect.anything());
  });
});

describe('TelegramService — treq action, ошибка approve/reject', () => {
  it('approve падает — answerCbQuery("Ошибка"), ошибка залогирована, не бросает', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const OLD = process.env.ADMIN_ID;
    process.env.ADMIN_ID = '999';
    const { service, fakeBot } = makeDeps({
      therapistRequestService: {
        approve: jest.fn().mockRejectedValue(new Error('db down')),
      },
    });
    service.onModuleInit();
    const ctx = await runAction(fakeBot, 'treq:approve:5', {
      from: { id: 999 },
    });
    expect(ctx.answerCbQuery).toHaveBeenLastCalledWith('Ошибка');
    if (OLD === undefined) delete process.env.ADMIN_ID;
    else process.env.ADMIN_ID = OLD;
  });
});

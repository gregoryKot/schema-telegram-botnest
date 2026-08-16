// Поведенческие тесты /start: все ветки онбординга (pair-инвайт, согласие,
// выбор ты/вы, возвращение со стриком, ошибка). accept_consent/
// accept:(ty|vy)/cancel/back:welcome/treq — telegram.service.consent.spec.ts
// (лимит ~300 строк на файл, CLAUDE.md).
import { Logger } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { makeFakeBot, runCommand } from './telegram.test-helpers.spec';

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
    getConsecutiveDays: jest.fn().mockResolvedValue(0),
    ...overrides.analyticsService,
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
    pairsService,
    analyticsEvents,
  };
}

beforeEach(() => {
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('TelegramService — /start без from.id (крайний случай апдейта Telegram)', () => {
  it('тихо выходит, ничего не пишет и не падает', async () => {
    const { service, fakeBot, accountService } = makeDeps();
    service.onModuleInit();
    const ctx = await runCommand(fakeBot, 'start', { from: undefined });
    // .mock.calls вместо голого toHaveBeenCalled() — храповик weak-assert
    // (scripts/check-weak-assert-ratchet.mjs) считает toHaveBeenCalled()/
    // toHaveBeenCalledTimes() без проверки аргументов слабым ассертом.
    expect(accountService.registerUser.mock.calls).toEqual([]);
    expect(ctx.reply.mock.calls).toEqual([]);
  });
});

describe('TelegramService — /start pair_XXX с уже принятым согласием', () => {
  it('успешное присоединение — сообщение "Вы в паре!"', async () => {
    const { service, fakeBot, pairsService } = makeDeps({
      botService: { hasAcceptedDisclaimer: jest.fn().mockResolvedValue(true) },
    });
    service.onModuleInit();
    const ctx = await runCommand(fakeBot, 'start', {
      from: { id: 1 },
      startPayload: 'pair_xyz789',
    });
    expect(pairsService.joinPair).toHaveBeenCalledWith(1n, 'XYZ789');
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Вы в паре!'),
      expect.anything(),
    );
  });

  it('код невалиден/использован — сообщение об ошибке ссылки', async () => {
    const { service, fakeBot } = makeDeps({
      botService: { hasAcceptedDisclaimer: jest.fn().mockResolvedValue(true) },
      pairsService: { joinPair: jest.fn().mockResolvedValue(false) },
    });
    service.onModuleInit();
    const ctx = await runCommand(fakeBot, 'start', {
      from: { id: 1 },
      startPayload: 'pair_bad',
    });
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('недействительна'),
      expect.anything(),
    );
  });
});

describe('TelegramService — /start без pair-payload', () => {
  it('согласие не принято — CONSENT_TEXT', async () => {
    const { service, fakeBot } = makeDeps();
    service.onModuleInit();
    const ctx = await runCommand(fakeBot, 'start', { from: { id: 1 } });
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Соглашение'),
      expect.anything(),
    );
  });

  it('согласие принято, но форма обращения не выбрана — ADDRESS_PROMPT', async () => {
    const { service, fakeBot } = makeDeps({
      botService: {
        hasAcceptedDisclaimer: jest.fn().mockResolvedValue(true),
        getUserSettings: jest.fn().mockResolvedValue({ addressForm: null }),
      },
    });
    service.onModuleInit();
    const ctx = await runCommand(fakeBot, 'start', { from: { id: 1 } });
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('как удобнее общаться'),
      expect.anything(),
    );
  });

  it('новый юзер (нет existingSettings) с формой — приветствие WELCOME_TEXT, без стрика', async () => {
    const { service, fakeBot } = makeDeps({
      botService: {
        hasAcceptedDisclaimer: jest.fn().mockResolvedValue(true),
        getUserSettings: jest.fn().mockResolvedValue(null),
      },
    });
    service.onModuleInit();
    const ctx = await runCommand(fakeBot, 'start', {
      from: { id: 1, first_name: 'Аня' },
    });
    // existingSettings===null ⇒ isReturning=false, даже с формой не выбранной
    // ветка ADDRESS_PROMPT сработала бы раньше — здесь settings есть с формой.
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('как удобнее общаться'),
      expect.anything(),
    );
  });

  it('возвращающийся юзер с формой, стрик >= 3 — показывает серию дней', async () => {
    const { service, fakeBot } = makeDeps({
      botService: {
        hasAcceptedDisclaimer: jest.fn().mockResolvedValue(true),
        getUserSettings: jest.fn().mockResolvedValue({ addressForm: 'ty' }),
      },
      analyticsService: { getConsecutiveDays: jest.fn().mockResolvedValue(5) },
    });
    service.onModuleInit();
    const ctx = await runCommand(fakeBot, 'start', {
      from: { id: 1, first_name: 'Аня' },
    });
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('С возвращением Аня!'),
      expect.anything(),
    );
    expect(ctx.reply.mock.calls[0][0]).toContain('🔥 Серия: 5 дней подряд');
  });

  it('возвращающийся юзер, стрик < 3 — без строки серии', async () => {
    const { service, fakeBot } = makeDeps({
      botService: {
        hasAcceptedDisclaimer: jest.fn().mockResolvedValue(true),
        getUserSettings: jest.fn().mockResolvedValue({ addressForm: 'ty' }),
      },
      analyticsService: { getConsecutiveDays: jest.fn().mockResolvedValue(1) },
    });
    service.onModuleInit();
    const ctx = await runCommand(fakeBot, 'start', { from: { id: 1 } });
    expect(ctx.reply.mock.calls[0][0]).not.toContain('Серия');
  });

  it('стрик ровно 1 день склоняется как "дня", не "дней" (streak < 5)', async () => {
    const { service, fakeBot } = makeDeps({
      botService: {
        hasAcceptedDisclaimer: jest.fn().mockResolvedValue(true),
        getUserSettings: jest.fn().mockResolvedValue({ addressForm: 'ty' }),
      },
      analyticsService: { getConsecutiveDays: jest.fn().mockResolvedValue(4) },
    });
    service.onModuleInit();
    const ctx = await runCommand(fakeBot, 'start', { from: { id: 1 } });
    expect(ctx.reply.mock.calls[0][0]).toContain('4 дня подряд');
  });

  it('ошибка внутри хендлера — ловится, отвечает фолбэком с кнопкой мини-аппа', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { service, fakeBot } = makeDeps({
      botService: {
        getUserSettings: jest.fn().mockRejectedValue(new Error('db down')),
      },
    });
    service.onModuleInit();
    const ctx = await runCommand(fakeBot, 'start', { from: { id: 1 } });
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Что-то пошло не так'),
      expect.anything(),
    );
  });
});

// accept_consent/accept:(ty|vy)/cancel/back:welcome/treq — в
// telegram.service.consent.spec.ts.

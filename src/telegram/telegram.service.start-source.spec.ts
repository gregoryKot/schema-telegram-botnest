// Атрибуция посева: /start с deep-link `src_<slug>` пишет signup_source
// РОВНО ОДИН РАЗ, при первом касании нового юзера, до гейта согласия (чтобы
// видеть и конверсию «переход → принял соглашение»). Продолжение
// telegram.service.onboarding.spec.ts — свой файл (лимит ~300 строк,
// CLAUDE.md), makeDeps по тому же образцу.
import { Logger } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { makeFakeBot, runCommand } from './telegram.test-helpers.spec';

function makeDeps(overrides: Record<string, any> = {}) {
  const botService = {
    // По умолчанию — новый юзер (getUserSettings → null, isReturning=false).
    getUserSettings: jest.fn().mockResolvedValue(null),
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
  const practicesService = { ...overrides.practicesService };
  const notificationService = { ...overrides.notificationService };
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
  return { service, fakeBot, analyticsEvents, pairsService };
}

beforeEach(() => {
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('TelegramService — /start src_<slug> (атрибуция посева)', () => {
  it('новый юзер, известный slug — пишет signup_source один раз с нормализованным src', async () => {
    const { fakeBot, service, analyticsEvents } = makeDeps();
    service.onModuleInit();
    await runCommand(fakeBot, 'start', {
      from: { id: 42 },
      payload: 'src_seed1',
    });
    expect(analyticsEvents.track).toHaveBeenCalledTimes(1);
    expect(analyticsEvents.track).toHaveBeenCalledWith(42n, 'signup_source', {
      src: 'seed1',
    });
  });

  it('новый юзер, неизвестный/мусорный slug — нормализуется в other (правило №7)', async () => {
    const { fakeBot, service, analyticsEvents } = makeDeps();
    service.onModuleInit();
    await runCommand(fakeBot, 'start', {
      from: { id: 42 },
      payload: 'src_черный_нал',
    });
    expect(analyticsEvents.track).toHaveBeenCalledWith(42n, 'signup_source', {
      src: 'other',
    });
  });

  it('возвращающийся юзер по той же ссылке — НЕ пишет событие повторно', async () => {
    const { fakeBot, service, analyticsEvents } = makeDeps({
      botService: {
        getUserSettings: jest.fn().mockResolvedValue({ addressForm: 'ty' }),
        hasAcceptedDisclaimer: jest.fn().mockResolvedValue(true),
      },
    });
    service.onModuleInit();
    const ctx = await runCommand(fakeBot, 'start', {
      from: { id: 42 },
      payload: 'src_seed1',
    });
    // Голого not.toHaveBeenCalled() недостаточно: он же прошёл бы, если бы
    // isReturning вообще не считался и track() не вызывался никогда — тест
    // должен убедиться, что ветка src_ реально дошла до проверки isReturning
    // (а не была пропущена целиком) и что обычный сценарий возврата не
    // сломан: юзер всё равно получает приветствие «с возвращением».
    expect(analyticsEvents.track).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('С возвращением'),
      expect.anything(),
    );
  });

  it('пишется ДО гейта согласия — событие есть, даже если согласие ещё не принято', async () => {
    const { fakeBot, service, analyticsEvents } = makeDeps({
      botService: { hasAcceptedDisclaimer: jest.fn().mockResolvedValue(false) },
    });
    service.onModuleInit();
    const ctx = await runCommand(fakeBot, 'start', {
      from: { id: 42 },
      payload: 'src_channel',
    });
    expect(analyticsEvents.track).toHaveBeenCalledWith(42n, 'signup_source', {
      src: 'channel',
    });
    // ...и при этом всё равно показывает экран согласия — ветка src_ не
    // подменяет и не пропускает обычный онбординг.
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Соглашение'),
      expect.anything(),
    );
  });

  it('pair_-payload не трогается веткой src_ — событие не пишется, пара всё ещё работает', async () => {
    const { fakeBot, service, analyticsEvents, pairsService } = makeDeps({
      botService: { hasAcceptedDisclaimer: jest.fn().mockResolvedValue(true) },
    });
    service.onModuleInit();
    const ctx = await runCommand(fakeBot, 'start', {
      from: { id: 42 },
      payload: 'pair_abc123',
    });
    expect(analyticsEvents.track).not.toHaveBeenCalled();
    expect(pairsService.joinPair).toHaveBeenCalledWith(42n, 'ABC123');
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Вы в паре!'),
      expect.anything(),
    );
  });

  it('/start без payload — событие не пишется вовсе', async () => {
    const { fakeBot, service, analyticsEvents } = makeDeps();
    service.onModuleInit();
    const ctx = await runCommand(fakeBot, 'start', { from: { id: 42 } });
    expect(analyticsEvents.track).not.toHaveBeenCalled();
    // ...и обычный онбординг всё равно идёт — гейт согласия показывается,
    // отсутствие payload не глушит хендлер молча (не «упал раньше» из-за
    // необработанного undefined-пейлоада).
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Соглашение'),
      expect.anything(),
    );
  });
});

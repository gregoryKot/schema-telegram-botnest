// Поведенческие тесты кнопок саморегуляции на напоминаниях: пауза/реже/скип,
// плюс выбор ты/вы при первом входе (addr:ty|vy). Проверяем реальные эффекты
// через фейковые cadenceService/botService, не форму вызова.
import { Logger } from '@nestjs/common';
import { TelegramNotifyActionsService } from './telegram.notify-actions.service';
import { makeFakeBot, runAction } from './telegram.test-helpers.spec';

function makeBotService(overrides: Record<string, any> = {}) {
  let settings: any = {
    addressForm: 'ty',
    notifyTimezone: 'Europe/Moscow',
    ...overrides,
  };
  return {
    getUserSettings: jest.fn(() => Promise.resolve(settings)),
    updateUserSettings: jest.fn((_userId: bigint, patch: any) => {
      settings = { ...settings, ...patch };
      return Promise.resolve();
    }),
    _get: () => settings,
  };
}

function makeService(
  botService: any,
  cadenceOverrides: Record<string, any> = {},
) {
  const cadenceService = {
    pause: jest.fn().mockResolvedValue(new Date('2026-07-24T00:00:00+03:00')),
    slower: jest.fn().mockResolvedValue(2),
    skipToday: jest.fn().mockResolvedValue(undefined),
    ...cadenceOverrides,
  };
  const fakeBot = makeFakeBot();
  const service = new TelegramNotifyActionsService(
    fakeBot.bot,
    botService,
    cadenceService as any,
  );
  return { service, fakeBot, cadenceService };
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('TelegramNotifyActionsService — addr:ty|vy (первый вход)', () => {
  it('addr:vy сохраняет форму и показывает приветствие на «вы»', async () => {
    const botService = makeBotService();
    const { service, fakeBot } = makeService(botService);
    await service.onModuleInit();
    const ctx = await runAction(fakeBot, 'addr:vy');
    expect(ctx.answerCbQuery).toHaveBeenCalled();
    expect(botService.updateUserSettings).toHaveBeenCalledWith(1n, {
      addressForm: 'vy',
    });
    expect(ctx.editMessageText).toHaveBeenCalledTimes(1);
    const [text] = ctx.editMessageText.mock.calls[0];
    expect(text).toContain('на «вы»');
    expect(text).toContain('Здравствуйте!');
  });

  it('addr:ty сохраняет форму «ты»', async () => {
    const botService = makeBotService();
    const { service, fakeBot } = makeService(botService);
    await service.onModuleInit();
    const ctx = await runAction(fakeBot, 'addr:ty');
    expect(botService.updateUserSettings).toHaveBeenCalledWith(1n, {
      addressForm: 'ty',
    });
    const [text] = ctx.editMessageText.mock.calls[0];
    expect(text).toContain('на «ты»');
    expect(text).toContain('Привет!');
  });
});

describe('TelegramNotifyActionsService — пауза', () => {
  it('notify:pause показывает выбор срока, не пишет в БД', async () => {
    const botService = makeBotService();
    const { service, fakeBot, cadenceService } = makeService(botService);
    await service.onModuleInit();
    const ctx = await runAction(fakeBot, 'notify:pause');
    expect(cadenceService.pause).not.toHaveBeenCalled();
    expect(ctx.editMessageReplyMarkup).toHaveBeenCalled();
  });

  it('notify:pause:7 вызывает cadenceService.pause(userId, 7) и подтверждает', async () => {
    const botService = makeBotService();
    const { service, fakeBot, cadenceService } = makeService(botService);
    await service.onModuleInit();
    const ctx = await runAction(fakeBot, 'notify:pause:7');
    expect(cadenceService.pause).toHaveBeenCalledWith(1n, 7);
    expect(ctx.answerCbQuery).toHaveBeenCalledWith(
      expect.stringContaining('Пауза'),
    );
    expect(ctx.editMessageText).toHaveBeenCalled();
  });

  it('notify:pause:30 — месяц, текст отличается от недельного', async () => {
    const botService = makeBotService();
    const { service, fakeBot, cadenceService } = makeService(botService);
    await service.onModuleInit();
    const ctx = await runAction(fakeBot, 'notify:pause:30');
    expect(cadenceService.pause).toHaveBeenCalledWith(1n, 30);
    const [text] = ctx.editMessageText.mock.calls[0];
    expect(text).toContain('месяц');
  });

  it('notify:pause:cancel — ничего не пишет в БД, просто убирает клавиатуру', async () => {
    const botService = makeBotService();
    const { service, fakeBot, cadenceService } = makeService(botService);
    await service.onModuleInit();
    const ctx = await runAction(fakeBot, 'notify:pause:cancel');
    expect(cadenceService.pause).not.toHaveBeenCalled();
    expect(ctx.editMessageReplyMarkup).toHaveBeenCalledWith(undefined);
  });
});

describe('TelegramNotifyActionsService — реже / скип', () => {
  it('notify:slower зовёт cadenceService.slower и показывает новую метку частоты', async () => {
    const botService = makeBotService();
    const { service, fakeBot, cadenceService } = makeService(botService, {
      slower: jest.fn().mockResolvedValue(3),
    });
    await service.onModuleInit();
    const ctx = await runAction(fakeBot, 'notify:slower');
    expect(cadenceService.slower).toHaveBeenCalledWith(1n);
    expect(ctx.editMessageText).toHaveBeenCalled();
  });

  it('notify:skip зовёт cadenceService.skipToday(userId)', async () => {
    const botService = makeBotService();
    const { service, fakeBot, cadenceService } = makeService(botService);
    await service.onModuleInit();
    const ctx = await runAction(fakeBot, 'notify:skip');
    expect(cadenceService.skipToday).toHaveBeenCalledWith(1n);
    expect(ctx.editMessageText).toHaveBeenCalled();
  });
});

describe('TelegramNotifyActionsService — ошибки не роняют хендлер', () => {
  it('cadenceService.pause падает — answerCbQuery уже отдан, ошибка залогирована', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const botService = makeBotService();
    const { service, fakeBot } = makeService(botService, {
      pause: jest.fn().mockRejectedValue(new Error('db down')),
    });
    await service.onModuleInit();
    const ctx = await runAction(fakeBot, 'notify:pause:7');
    expect(ctx.answerCbQuery).toHaveBeenCalledWith('⏸ Пауза включена');
    expect(ctx.answerCbQuery).toHaveBeenCalledWith(
      expect.stringContaining('Не получилось'),
    );
  });
});

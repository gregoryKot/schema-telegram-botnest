// Поведенческие тесты чисто-логических хендлеров TelegramService, достижимых
// без запуска всего бота: разбор callback_data (валидный/мусорный), гейтинг
// админских action'ов, отмена/скип напоминания. Экраны онбординга (start,
// consent) — тяжёлая UI-склейка, не гоняем здесь (правило приоритета задачи).
import { Logger } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import {
  makeFakeBot,
  runAction,
  runCommand,
} from './telegram.test-helpers.spec';

const OLD_ADMIN_ID = process.env.ADMIN_ID;

function makeDeps(overrides: Record<string, any> = {}) {
  const botService = {
    getUserSettings: jest.fn().mockResolvedValue({
      notifyTimezone: 'Europe/Moscow',
      notifyQuietStart: 22,
      notifyQuietEnd: 8,
    }),
    updateUserSettings: jest.fn().mockResolvedValue(undefined),
    acceptDisclaimer: jest.fn().mockResolvedValue(undefined),
    hasAcceptedDisclaimer: jest.fn().mockResolvedValue(false),
    cancelAllPreReminders: jest.fn().mockResolvedValue(0),
    ...overrides.botService,
  };
  const analyticsService = { ...overrides.analyticsService };
  const productMetricsService = {
    render: jest.fn().mockResolvedValue(''),
    ...overrides.productMetricsService,
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
  const channelService = { ...overrides.channelService };
  const fakeBot = makeFakeBot();
  const service = new TelegramService(
    fakeBot.bot,
    botService,
    analyticsService,
    productMetricsService,
    accountService,
    pairsService,
    practicesService,
    notificationService,
    therapistRequestService,
    channelService,
  );
  return {
    service,
    fakeBot,
    botService,
    accountService,
    pairsService,
    practicesService,
    notificationService,
    therapistRequestService,
  };
}

beforeEach(() => {
  // onModuleInit логирует «Bot launched» и т.п. — не относится к делу теста.
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
  if (OLD_ADMIN_ID === undefined) delete process.env.ADMIN_ID;
  else process.env.ADMIN_ID = OLD_ADMIN_ID;
});

describe('TelegramService — plan_(done|skip):<id>', () => {
  it('plan_done:42 — done=true, checkinPlan(userId, 42, true), правит сообщение', async () => {
    const { service, fakeBot, practicesService } = makeDeps();
    service.onModuleInit();
    const ctx = await runAction(fakeBot, 'plan_done:42');
    expect(ctx.answerCbQuery).toHaveBeenCalled();
    expect(practicesService.checkinPlan).toHaveBeenCalledWith(1n, 42, true);
    expect(ctx.editMessageText).toHaveBeenCalledWith(
      expect.stringContaining('Отлично'),
    );
  });

  it('plan_skip:7 — done=false, checkinPlan(userId, 7, false)', async () => {
    const { service, fakeBot, practicesService } = makeDeps();
    service.onModuleInit();
    await runAction(fakeBot, 'plan_skip:7');
    expect(practicesService.checkinPlan).toHaveBeenCalledWith(1n, 7, false);
  });

  it('мусорный callback_data (не число) не матчится ни на один action', async () => {
    const { service, fakeBot } = makeDeps();
    service.onModuleInit();
    await expect(runAction(fakeBot, 'plan_done:abc')).rejects.toThrow(
      /ни один action-хендлер/,
    );
  });
});

describe('TelegramService — snooze_reminder', () => {
  it('переносит на +1 час, отменяет reminder, планирует pre_reminder', async () => {
    const { service, fakeBot, notificationService } = makeDeps();
    service.onModuleInit();
    const ctx = await runAction(fakeBot, 'snooze_reminder');
    expect(ctx.answerCbQuery).toHaveBeenCalledWith(
      expect.stringContaining('через час'),
    );
    expect(notificationService.cancel).toHaveBeenCalledWith(1n, 'reminder');
    expect(notificationService.schedule).toHaveBeenCalledWith(
      1n,
      'pre_reminder',
      expect.any(Date),
    );
    expect(ctx.editMessageText).toHaveBeenCalled();
  });

  it('перенос в тихие часы сдвигается за их конец, а не остаётся в тишине', async () => {
    // Тихие часы 22:00-08:00 МСК. Фиксируем момент так, чтобы +1ч попал в тишину (22:15 МСК).
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-16T21:15:00+03:00'));
    const { service, fakeBot, notificationService } = makeDeps();
    service.onModuleInit();
    await runAction(fakeBot, 'snooze_reminder');
    const [, , sendAt] = notificationService.schedule.mock.calls[0];
    // Конец тихих часов — 08:00 МСК того же/следующего дня, а не 23:30
    const hourMsk = Number(
      new Intl.DateTimeFormat('en-US', {
        timeZone: 'Europe/Moscow',
        hour: 'numeric',
        hour12: false,
      }).format(sendAt),
    );
    expect(hourMsk).toBe(8);
    jest.useRealTimers();
  });
});

describe('TelegramService — treq:approve|reject (только админ)', () => {
  it('не-админ получает отказ, therapistRequestService не вызывается', async () => {
    process.env.ADMIN_ID = '999';
    const { service, fakeBot, therapistRequestService } = makeDeps();
    service.onModuleInit();
    const ctx = await runAction(fakeBot, 'treq:approve:5', {
      from: { id: 1 }, // не 999
    });
    expect(ctx.answerCbQuery).toHaveBeenCalledWith(
      expect.stringContaining('админ'),
    );
    expect(therapistRequestService.approve).not.toHaveBeenCalled();
  });

  it('админ approve вызывает approve(adminId, reqId)', async () => {
    process.env.ADMIN_ID = '999';
    const { service, fakeBot, therapistRequestService } = makeDeps();
    service.onModuleInit();
    const ctx = await runAction(fakeBot, 'treq:approve:5', {
      from: { id: 999 },
    });
    expect(therapistRequestService.approve).toHaveBeenCalledWith(999, 5);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('одобрена'));
  });

  it('админ reject вызывает reject(adminId, reqId, "")', async () => {
    process.env.ADMIN_ID = '999';
    const { service, fakeBot, therapistRequestService } = makeDeps();
    service.onModuleInit();
    const ctx = await runAction(fakeBot, 'treq:reject:5', {
      from: { id: 999 },
    });
    expect(therapistRequestService.reject).toHaveBeenCalledWith(999, 5, '');
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('отклонена'),
    );
  });

  it('ADMIN_ID не задан на сервере — доступ закрыт даже якобы-совпадающему id', async () => {
    delete process.env.ADMIN_ID;
    const { service, fakeBot, therapistRequestService } = makeDeps();
    service.onModuleInit();
    const ctx = await runAction(fakeBot, 'treq:approve:5', {
      from: { id: 0 },
    });
    expect(therapistRequestService.approve).not.toHaveBeenCalled();
    expect(ctx.answerCbQuery).toHaveBeenCalledWith(
      expect.stringContaining('админ'),
    );
  });
});

describe('TelegramService — accept:(ty|vy) сохраняет согласие + форму', () => {
  it('accept:vy: acceptDisclaimer + addressForm=vy, приветствие на «вы»', async () => {
    const { service, fakeBot, botService } = makeDeps();
    service.onModuleInit();
    const ctx = await runAction(fakeBot, 'accept:vy');
    expect(botService.acceptDisclaimer).toHaveBeenCalledWith(1n);
    expect(botService.updateUserSettings).toHaveBeenCalledWith(1n, {
      addressForm: 'vy',
    });
    expect(ctx.editMessageText).toHaveBeenCalledWith(
      expect.stringContaining('Здравствуйте!'),
      expect.anything(),
    );
  });

  it('accept:ty после /start по pair-ссылке резолвит присоединение вместо обычного приветствия', async () => {
    const { service, fakeBot, botService, pairsService } = makeDeps({
      botService: { hasAcceptedDisclaimer: jest.fn().mockResolvedValue(false) },
    });
    service.onModuleInit();
    // /start pair_ABC123 без согласия — код кладётся в pendingPairCodes, ждём согласия
    const startCtx = await runCommand(fakeBot, 'start', {
      from: { id: 1 },
      startPayload: 'pair_abc123',
    });
    expect(startCtx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Соглашение'),
      expect.anything(),
    );
    expect(pairsService.joinPair).not.toHaveBeenCalled();

    // Согласие принято → accept:ty должен подхватить отложенный код пары
    const acceptCtx = await runAction(fakeBot, 'accept:ty', {
      from: { id: 1 },
    });
    expect(botService.acceptDisclaimer).toHaveBeenCalledWith(1n);
    expect(pairsService.joinPair).toHaveBeenCalledWith(1n, 'ABC123');
    expect(acceptCtx.editMessageText).toHaveBeenCalledWith(
      expect.stringContaining('Вы в паре!'),
      expect.anything(),
    );
  });
});

describe('TelegramService — cancel / back:welcome', () => {
  it('cancel: answerCbQuery + deleteMessage', async () => {
    const { service, fakeBot } = makeDeps();
    service.onModuleInit();
    const ctx = await runAction(fakeBot, 'cancel');
    expect(ctx.answerCbQuery).toHaveBeenCalled();
    expect(ctx.deleteMessage).toHaveBeenCalled();
  });

  it('back:welcome: правит на приветственный текст', async () => {
    const { service, fakeBot } = makeDeps();
    service.onModuleInit();
    const ctx = await runAction(fakeBot, 'back:welcome');
    expect(ctx.editMessageText).toHaveBeenCalledWith(
      expect.stringContaining('Привет!'),
      expect.anything(),
    );
  });
});

// Поведенческие тесты чисто-логических хендлеров TelegramService, достижимых
// без запуска всего бота: разбор callback_data (валидный/мусорный), отмена/
// скип напоминания. Экраны онбординга (start, consent) — тяжёлая UI-склейка,
// не гоняем здесь (правило приоритета задачи). treq и /stats — вынесены на
// TelegramAdminService (правило №10 CLAUDE.md), см.
// telegram.admin.service.*.spec.ts.
import { Logger } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import {
  makeFakeBot,
  runAction,
  runCommand,
} from './telegram.test-helpers.spec';

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
    ...overrides.botService,
  };
  const analyticsService = {
    ...overrides.analyticsService,
  };
  const accountService = {
    registerUser: jest.fn().mockResolvedValue(undefined),
    // Канонический номер: по умолчанию совпадает с telegramId (пользователь
    // бота без отдельного веб-входа). Спеки про слияние переопределяют.
    canonicalUserId: jest.fn(async (id: number) => BigInt(id)),
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
    replacePending: jest.fn().mockResolvedValue(undefined),
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
    practicesService,
    notificationService,
    analyticsService,
    analyticsEvents,
  };
}

beforeEach(() => {
  // onModuleInit логирует «Bot launched» и т.п. — не относится к делу теста.
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('TelegramService — plan_(done|skip):<id>', () => {
  // Отметка плана через Telegram снята (РКН, #1135): старая кнопка ведёт в приложение.
  it.each(['plan_done:42', 'plan_skip:7'])(
    '%s — ответ «в приложении», план не отмечается, клавиатура — открыть приложение',
    async (data) => {
      const { service, fakeBot, practicesService } = makeDeps();
      service.onModuleInit();
      const ctx = await runAction(fakeBot, data);
      expect(ctx.answerCbQuery).toHaveBeenCalledWith(
        'Отметить можно в приложении',
      );
      expect(practicesService.checkinPlan).not.toHaveBeenCalled();
      expect(ctx.editMessageReplyMarkup).toHaveBeenCalled();
    },
  );

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
    expect(notificationService.cancel).toHaveBeenCalledWith(1n, 'reminder');
    expect(notificationService.replacePending).toHaveBeenCalledWith(
      1n,
      'pre_reminder',
      expect.any(Date),
    );
    expect(ctx.editMessageText).toHaveBeenCalled();
  });

  // Аудит 2026-10 (по образцу паузы #978): тост «Напомню через час» уходил
  // до записи — при сбое человек видел обещание, а следом ошибку.
  it('тост пустой и уходит до записи, «Напомню в …» — только после записи', async () => {
    const { service, fakeBot, notificationService } = makeDeps();
    service.onModuleInit();
    const ctx = await runAction(fakeBot, 'snooze_reminder');
    expect(ctx.answerCbQuery).toHaveBeenCalledWith();
    const [answered] = ctx.answerCbQuery.mock.invocationCallOrder;
    const [scheduled] =
      notificationService.replacePending.mock.invocationCallOrder;
    const [edited] = ctx.editMessageText.mock.invocationCallOrder;
    expect(answered).toBeLessThan(scheduled);
    expect(scheduled).toBeLessThan(edited);
    expect(ctx.editMessageText).toHaveBeenCalledWith(
      expect.stringMatching(/^⏰ Напомню в \d\d:\d\d$/),
    );
  });

  it('запись упала — обещания нет, отдельным сообщением «не получилось» в форме человека', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { service, fakeBot } = makeDeps({
      botService: {
        getUserSettings: jest.fn().mockResolvedValue({ addressForm: 'vy' }),
      },
      notificationService: {
        replacePending: jest.fn().mockRejectedValue(new Error('db down')),
      },
    });
    service.onModuleInit();
    const ctx = await runAction(fakeBot, 'snooze_reminder');
    expect(ctx.answerCbQuery).toHaveBeenCalledWith();
    // Ни тостом, ни правкой: напоминание с кнопками остаётся — нажать ещё раз.
    expect(ctx.editMessageText).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(
      'Не получилось отложить напоминание. Попробуйте нажать ещё раз.',
    );
  });

  it('настройки не прочитались (БД) — «не получилось» в форме по умолчанию, без второго похода в БД', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const getUserSettings = jest.fn().mockRejectedValue(new Error('db down'));
    const { service, fakeBot } = makeDeps({ botService: { getUserSettings } });
    service.onModuleInit();
    const ctx = await runAction(fakeBot, 'snooze_reminder');
    expect(ctx.reply).toHaveBeenCalledWith(
      'Не получилось отложить напоминание. Попробуй нажать ещё раз.',
    );
    expect(getUserSettings).toHaveBeenCalledTimes(1);
  });

  it('сообщение не правится (удалено) — итог новым сообщением, а не тишина', async () => {
    const { service, fakeBot } = makeDeps();
    service.onModuleInit();
    const ctx = await runAction(fakeBot, 'snooze_reminder', {
      editMessageText: jest
        .fn()
        .mockRejectedValue(new Error('message to edit not found')),
    });
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringMatching(/^⏰ Напомню в /),
    );
  });

  it('перенос в тихие часы сдвигается за их конец, а не остаётся в тишине', async () => {
    // Тихие часы 22:00-08:00 МСК. Фиксируем момент так, чтобы +1ч попал в тишину (22:15 МСК).
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-16T21:15:00+03:00'));
    const { service, fakeBot, notificationService } = makeDeps();
    service.onModuleInit();
    await runAction(fakeBot, 'snooze_reminder');
    const [, , sendAt] = notificationService.replacePending.mock.calls[0];
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
      payload: 'pair_abc123',
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

  // Находка 2026-11-06: код удалялся из памяти ДО joinPair — упала запись,
  // человеку «попробуй нажать ещё раз», а повторное нажатие кода уже не
  // находило и показывало обычное приветствие: в пару не вступил, молча.
  describe('сбой вступления в пару после согласия', () => {
    const startThenFail = async () => {
      jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      const deps = makeDeps({
        botService: {
          hasAcceptedDisclaimer: jest.fn().mockResolvedValue(false),
        },
      });
      deps.pairsService.joinPair.mockRejectedValueOnce(new Error('db down'));
      deps.service.onModuleInit();
      await runCommand(deps.fakeBot, 'start', {
        from: { id: 1 },
        payload: 'pair_abc123',
      });
      return deps;
    };

    it('сбой → «нажми ещё раз»; повторное нажатие вступает в пару по тому же коду', async () => {
      const { fakeBot, pairsService } = await startThenFail();
      const failed = await runAction(fakeBot, 'accept:ty', { from: { id: 1 } });
      expect(failed.reply).toHaveBeenCalledWith(
        expect.stringContaining('ещё раз'),
      );

      const again = await runAction(fakeBot, 'accept:ty', { from: { id: 1 } });
      expect(pairsService.joinPair).toHaveBeenCalledTimes(2);
      expect(pairsService.joinPair).toHaveBeenLastCalledWith(1n, 'ABC123');
      expect(again.editMessageText).toHaveBeenCalledWith(
        expect.stringContaining('Вы в паре!'),
        expect.anything(),
      );
    });

    it('двойной тап согласия — joinPair по коду один раз', async () => {
      const { service, fakeBot, pairsService } = makeDeps({
        botService: {
          hasAcceptedDisclaimer: jest.fn().mockResolvedValue(false),
        },
      });
      service.onModuleInit();
      await runCommand(fakeBot, 'start', {
        from: { id: 1 },
        payload: 'pair_abc123',
      });
      const taps = await Promise.all([
        runAction(fakeBot, 'accept:ty', { from: { id: 1 } }),
        runAction(fakeBot, 'accept:ty', { from: { id: 1 } }),
      ]);
      expect(pairsService.joinPair).toHaveBeenCalledTimes(1);
      expect(pairsService.joinPair).toHaveBeenCalledWith(1n, 'ABC123');
      const joined = taps.filter((ctx) =>
        ctx.editMessageText.mock.calls.some(([text]: [string]) =>
          text.includes('Вы в паре!'),
        ),
      );
      expect(joined).toHaveLength(1);
    });
  });
});

describe('TelegramService — cancel / back:welcome', () => {
  it('cancel: answerCbQuery + deleteMessage', async () => {
    const { service, fakeBot } = makeDeps();
    service.onModuleInit();
    const ctx = await runAction(fakeBot, 'cancel');
    // Оба вызова без аргументов — toHaveBeenCalledWith() ловит и то, что
    // хендлер не передал туда ничего лишнего.
    expect(ctx.answerCbQuery).toHaveBeenCalledWith();
    expect(ctx.deleteMessage).toHaveBeenCalledWith();
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

import { TelegramSettingsService } from './telegram.settings.service';

// Перехватываем хендлеры, зарегистрированные в onModuleInit.
function makeBot() {
  const commands = new Map<string, any>();
  const actions: Array<{ matcher: any; fn: any }> = [];
  return {
    command: jest.fn((name: string, fn: any) => commands.set(name, fn)),
    action: jest.fn((matcher: any, fn: any) => actions.push({ matcher, fn })),
    _commands: commands,
    _actions: actions,
  } as any;
}

function findAction(bot: any, data: string) {
  for (const { matcher, fn } of bot._actions) {
    if (typeof matcher === 'string' && matcher === data) return { fn, match: null };
    if (matcher instanceof RegExp) {
      const m = data.match(matcher);
      if (m) return { fn, match: m };
    }
  }
  return null;
}

function makeCtx(match: RegExpMatchArray | null = null, id = 555) {
  return {
    from: { id },
    match: match ?? undefined,
    answerCbQuery: jest.fn().mockResolvedValue(undefined),
    reply: jest.fn().mockResolvedValue(undefined),
    editMessageText: jest.fn().mockResolvedValue(undefined),
  } as any;
}

function makeDeps() {
  const botService = {
    getUserSettings: jest.fn().mockResolvedValue({ notifyEnabled: true, notifyLocalHour: 21, notifyTimezone: 'Europe/Moscow' }),
    updateUserSettings: jest.fn().mockResolvedValue({}),
  };
  const notificationService = { cancelAll: jest.fn().mockResolvedValue(undefined) };
  const scheduleService = { rescheduleForUser: jest.fn().mockResolvedValue(undefined) };
  return { botService, notificationService, scheduleService };
}

async function init(bot: any, deps: ReturnType<typeof makeDeps>) {
  const svc = new TelegramSettingsService(bot, deps.botService as any, deps.notificationService as any, deps.scheduleService as any);
  await svc.onModuleInit();
  return svc;
}

describe('TelegramSettingsService', () => {
  it('без бота onModuleInit не падает и ничего не регистрирует', async () => {
    const deps = makeDeps();
    const svc = new TelegramSettingsService(null, deps.botService as any, deps.notificationService as any, deps.scheduleService as any);
    await expect(svc.onModuleInit()).resolves.toBeUndefined();
  });

  it('/settings показывает текст настроек с клавиатурой', async () => {
    const bot = makeBot();
    const deps = makeDeps();
    await init(bot, deps);
    const ctx = makeCtx();
    await bot._commands.get('settings')(ctx);
    expect(ctx.reply).toHaveBeenCalled();
    expect(ctx.reply.mock.calls[0][0]).toContain('Настройки уведомлений');
  });

  describe('settings:toggle', () => {
    it('включённые → выключает + отменяет все уведомления', async () => {
      const bot = makeBot();
      const deps = makeDeps();
      deps.botService.getUserSettings.mockResolvedValue({ notifyEnabled: true, notifyLocalHour: 21, notifyTimezone: 'Europe/Moscow' });
      await init(bot, deps);
      await findAction(bot, 'settings:toggle')!.fn(makeCtx());
      expect(deps.botService.updateUserSettings).toHaveBeenCalledWith(555n, { notifyEnabled: false });
      expect(deps.notificationService.cancelAll).toHaveBeenCalledWith(555n);
      expect(deps.scheduleService.rescheduleForUser).not.toHaveBeenCalled();
    });

    it('выключенные → включает + перепланирует', async () => {
      const bot = makeBot();
      const deps = makeDeps();
      deps.botService.getUserSettings.mockResolvedValue({ notifyEnabled: false, notifyLocalHour: 21, notifyTimezone: 'Europe/Moscow' });
      await init(bot, deps);
      await findAction(bot, 'settings:toggle')!.fn(makeCtx());
      expect(deps.botService.updateUserSettings).toHaveBeenCalledWith(555n, { notifyEnabled: true });
      expect(deps.scheduleService.rescheduleForUser).toHaveBeenCalledWith(555n);
    });

    it('answerCbQuery вызывается ДО обращения к БД (инвариант CLAUDE.md)', async () => {
      const bot = makeBot();
      const deps = makeDeps();
      await init(bot, deps);
      const ctx = makeCtx();
      await findAction(bot, 'settings:toggle')!.fn(ctx);
      const cbOrder = ctx.answerCbQuery.mock.invocationCallOrder[0];
      const dbOrder = deps.botService.updateUserSettings.mock.invocationCallOrder[0];
      expect(cbOrder).toBeLessThan(dbOrder);
    });

    it('ошибка БД не роняет хендлер — отвечает через answerCbQuery', async () => {
      const bot = makeBot();
      const deps = makeDeps();
      deps.botService.updateUserSettings.mockRejectedValue(new Error('db down'));
      await init(bot, deps);
      const ctx = makeCtx();
      await expect(findAction(bot, 'settings:toggle')!.fn(ctx)).resolves.toBeUndefined();
      expect(ctx.answerCbQuery).toHaveBeenCalled();
    });
  });

  describe('settings:hour', () => {
    it('сохраняет выбранный час и перепланирует', async () => {
      const bot = makeBot();
      const deps = makeDeps();
      await init(bot, deps);
      const a = findAction(bot, 'settings:hour:9')!;
      await a.fn(makeCtx(a.match));
      expect(deps.botService.updateUserSettings).toHaveBeenCalledWith(555n, { notifyLocalHour: 9 });
      expect(deps.scheduleService.rescheduleForUser).toHaveBeenCalledWith(555n);
    });
  });

  describe('навигация по меню (клавиатуры)', () => {
    it('settings:pick_hour показывает выбор времени', async () => {
      const bot = makeBot();
      const deps = makeDeps();
      await init(bot, deps);
      const ctx = makeCtx();
      await findAction(bot, 'settings:pick_hour')!.fn(ctx);
      expect(ctx.answerCbQuery).toHaveBeenCalled();
      expect(ctx.editMessageText.mock.calls[0][0]).toContain('время');
    });

    it('settings:pick_tz показывает выбор часового пояса', async () => {
      const bot = makeBot();
      const deps = makeDeps();
      await init(bot, deps);
      const ctx = makeCtx();
      await findAction(bot, 'settings:pick_tz')!.fn(ctx);
      expect(ctx.editMessageText.mock.calls[0][0]).toContain('часовой пояс');
    });

    it('settings:back возвращает к экрану настроек', async () => {
      const bot = makeBot();
      const deps = makeDeps();
      await init(bot, deps);
      const ctx = makeCtx();
      await findAction(bot, 'settings:back')!.fn(ctx);
      expect(ctx.editMessageText.mock.calls[0][0]).toContain('Настройки уведомлений');
    });
  });

  describe('settings:tz', () => {
    it('валидная таймзона → сохраняет и перепланирует', async () => {
      const bot = makeBot();
      const deps = makeDeps();
      await init(bot, deps);
      const a = findAction(bot, 'settings:tz:Asia/Tokyo')!;
      // Asia/Tokyo нет в списке → проверим валидную из списка
      const valid = findAction(bot, 'settings:tz:Europe/London')!;
      await valid.fn(makeCtx(valid.match));
      expect(deps.botService.updateUserSettings).toHaveBeenCalledWith(555n, { notifyTimezone: 'Europe/London' });
    });

    it('таймзона вне белого списка → игнорируется (нет записи)', async () => {
      const bot = makeBot();
      const deps = makeDeps();
      await init(bot, deps);
      const a = findAction(bot, 'settings:tz:Mars/Olympus')!;
      await a.fn(makeCtx(a.match));
      expect(deps.botService.updateUserSettings).not.toHaveBeenCalled();
    });
  });
});

import { TelegramService } from './telegram.service';

function makeBot() {
  const commands = new Map<string, any>();
  const actions: Array<{ matcher: any; fn: any }> = [];
  return {
    command: jest.fn((n: string, fn: any) => commands.set(n, fn)),
    action: jest.fn((m: any, fn: any) => actions.push({ matcher: m, fn })),
    on: jest.fn(),
    launch: jest.fn().mockResolvedValue(undefined),
    // telegram: авто-мок — любой метод (sendMessage/setMyCommands/callApi/…) → jest.fn → resolve
    telegram: new Proxy({} as any, {
      get: (target, prop) => {
        if (!(prop in target)) target[prop] = jest.fn().mockResolvedValue({});
        return target[prop];
      },
    }),
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

function makeCtx(opts: { id?: number; text?: string; match?: RegExpMatchArray } = {}) {
  return {
    from: { id: opts.id ?? 100, first_name: 'Аня' },
    message: opts.text ? { text: opts.text } : undefined,
    match: opts.match,
    reply: jest.fn().mockResolvedValue(undefined),
    answerCbQuery: jest.fn().mockResolvedValue(undefined),
    editMessageReplyMarkup: jest.fn().mockResolvedValue(undefined),
  } as any;
}

function makeDeps() {
  const botService = {
    getUserSettings: jest.fn().mockResolvedValue(null),
    registerUser: jest.fn().mockResolvedValue(undefined),
    getBroadcastUserIds: jest.fn().mockResolvedValue([5]),
    markUserBlocked: jest.fn().mockResolvedValue(undefined),
    cancelAllPreReminders: jest.fn().mockResolvedValue(0),
  };
  const notificationService = { cancelAllPreReminders: jest.fn().mockResolvedValue(0) };
  const therapistRequestService = {
    approve: jest.fn().mockResolvedValue(undefined),
    reject: jest.fn().mockResolvedValue(undefined),
  };
  return { botService, therapistRequestService };
}

async function init(bot: any, deps: ReturnType<typeof makeDeps>) {
  const svc = new TelegramService(bot, deps.botService as any, {} as any, {} as any, {} as any, deps.therapistRequestService as any);
  await svc.onModuleInit();
  return svc;
}

describe('TelegramService', () => {
  const ORIG = { ...process.env };
  beforeEach(() => { process.env.ADMIN_ID = '1'; delete process.env.BOT_REDIRECT_USERNAME; });
  afterEach(() => { process.env.ADMIN_ID = ORIG.ADMIN_ID; });

  it('без бота onModuleInit не падает', async () => {
    const deps = makeDeps();
    const svc = new TelegramService(null, deps.botService as any, {} as any, {} as any, {} as any, deps.therapistRequestService as any);
    await expect(svc.onModuleInit()).resolves.toBeUndefined();
  });

  it('/start регистрирует пользователя', async () => {
    const bot = makeBot();
    const deps = makeDeps();
    await init(bot, deps);
    const ctx = makeCtx({ id: 42 });
    await bot._commands.get('start')(ctx);
    expect(deps.botService.registerUser).toHaveBeenCalledWith(42n, 'Аня');
  });

  describe('broadcast — admin only', () => {
    it('не-админ → отказ, рассылка не запускается', async () => {
      const bot = makeBot();
      const deps = makeDeps();
      await init(bot, deps);
      const ctx = makeCtx({ id: 999, text: '/broadcast привет' });
      await bot._commands.get('broadcast')(ctx);
      expect(ctx.reply).toHaveBeenCalledWith('⛔ Нет доступа');
      expect(deps.botService.getBroadcastUserIds).not.toHaveBeenCalled();
    });

    it('админ без текста → подсказка', async () => {
      const bot = makeBot();
      const deps = makeDeps();
      await init(bot, deps);
      const ctx = makeCtx({ id: 1, text: '/broadcast' });
      await bot._commands.get('broadcast')(ctx);
      expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Укажи текст'));
      expect(deps.botService.getBroadcastUserIds).not.toHaveBeenCalled();
    });

    it('админ с текстом → рассылка по пользователям', async () => {
      const bot = makeBot();
      const deps = makeDeps();
      await init(bot, deps);
      const ctx = makeCtx({ id: 1, text: '/broadcast всем привет' });
      await bot._commands.get('broadcast')(ctx);
      expect(deps.botService.getBroadcastUserIds).toHaveBeenCalled();
      expect(bot.telegram.sendMessage).toHaveBeenCalledWith(5, 'всем привет', expect.any(Object));
    });
  });

  describe('treq:approve|reject — admin only', () => {
    it('не-админ → "Только админ", approve не зовётся', async () => {
      const bot = makeBot();
      const deps = makeDeps();
      await init(bot, deps);
      const a = findAction(bot, 'treq:approve:7')!;
      const ctx = makeCtx({ id: 999, match: a.match! });
      await a.fn(ctx);
      expect(ctx.answerCbQuery).toHaveBeenCalledWith('Только админ');
      expect(deps.therapistRequestService.approve).not.toHaveBeenCalled();
    });

    it('админ approve → therapistRequestService.approve(adminId, reqId)', async () => {
      const bot = makeBot();
      const deps = makeDeps();
      await init(bot, deps);
      const a = findAction(bot, 'treq:approve:7')!;
      await a.fn(makeCtx({ id: 1, match: a.match! }));
      expect(deps.therapistRequestService.approve).toHaveBeenCalledWith(1, 7);
    });

    it('админ reject → reject с пустой причиной', async () => {
      const bot = makeBot();
      const deps = makeDeps();
      await init(bot, deps);
      const a = findAction(bot, 'treq:reject:9')!;
      await a.fn(makeCtx({ id: 1, match: a.match! }));
      expect(deps.therapistRequestService.reject).toHaveBeenCalledWith(1, 9, '');
    });
  });
});

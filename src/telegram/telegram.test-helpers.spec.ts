// Общий фейк Telegraf для behavior-тестов src/telegram/*.spec.ts, плюс
// маленькая самопроверка снизу файла (правило CLAUDE.md о тестах — раз файл
// содержит логику (matching callback_data), она обязана быть протестирована).
//
// Названо *.spec.ts, а не голым .ts, намеренно: только *.spec.ts исключены из
// продакшен-сборки (tsconfig.build.json) — иначе `jest.fn()` в проде не
// типизируется (нет @types/jest) и `tsc -p tsconfig.build.json` падает.
//
// Идея: сервисы регистрируют хендлеры через this.bot.command(...)/this.bot.action(...)
// внутри onModuleInit(). makeFakeBot() перехватывает регистрацию (как реальный Telegraf,
// без сети) — дальше тест вызывает хендлер напрямую через runCommand/runAction с
// поддельным ctx, проверяя реальные побочные эффекты через фейковые сервисы.

export type Handler = (ctx: any) => Promise<void> | void;

interface ActionEntry {
  matcher: string | RegExp;
  handler: Handler;
}

export interface FakeBot {
  bot: any; // передаётся в конструктор сервиса как Telegraf<Context>
  commands: Map<string, Handler>;
  actions: ActionEntry[];
  telegram: {
    sendMessage: jest.Mock;
    setMyCommands: jest.Mock;
    callApi: jest.Mock;
  };
}

/** Создаёт фейковый Telegraf-бот, перехватывающий регистрацию хендлеров. */
export function makeFakeBot(): FakeBot {
  const commands = new Map<string, Handler>();
  const actions: ActionEntry[] = [];
  const telegram = {
    sendMessage: jest.fn().mockResolvedValue(undefined),
    setMyCommands: jest.fn().mockResolvedValue(undefined),
    callApi: jest.fn().mockResolvedValue(undefined),
  };
  const bot: any = {
    command: jest.fn((name: string, handler: Handler) => {
      commands.set(name, handler);
    }),
    action: jest.fn((matcher: string | RegExp, handler: Handler) => {
      actions.push({ matcher, handler });
    }),
    on: jest.fn(),
    launch: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
    telegram,
  };
  return { bot, commands, actions, telegram };
}

/** Поддельный ctx: все методы Telegraf, которые дёргают хендлеры, — jest.fn(). */
export function makeCtx(overrides: Record<string, any> = {}): any {
  return {
    from: { id: 1, first_name: 'Тест' },
    reply: jest.fn().mockResolvedValue(undefined),
    editMessageText: jest.fn().mockResolvedValue(undefined),
    editMessageReplyMarkup: jest.fn().mockResolvedValue(undefined),
    answerCbQuery: jest.fn().mockResolvedValue(undefined),
    deleteMessage: jest.fn().mockResolvedValue(undefined),
    match: null,
    ...overrides,
  };
}

/** Находит и вызывает command-хендлер по точному имени, с поддельным ctx. */
export async function runCommand(
  fakeBot: FakeBot,
  name: string,
  ctxOverrides: Record<string, any> = {},
): Promise<any> {
  const handler = fakeBot.commands.get(name);
  if (!handler) throw new Error(`command "${name}" не зарегистрирован`);
  const ctx = makeCtx(ctxOverrides);
  await handler(ctx);
  return ctx;
}

/**
 * Находит action-хендлер, чей matcher совпадает с callback_data (как реальный
 * Telegraf: строка — точное совпадение, regex — .exec()), вызывает с ctx,
 * куда для regex подставлен ctx.match. Бросает, если совпадений нет —
 * тест на «неизвестный callback_data» должен явно проверять «не нашлось».
 */
export async function runAction(
  fakeBot: FakeBot,
  data: string,
  ctxOverrides: Record<string, any> = {},
): Promise<any> {
  for (const { matcher, handler } of fakeBot.actions) {
    if (typeof matcher === 'string') {
      if (matcher === data) {
        const ctx = makeCtx(ctxOverrides);
        await handler(ctx);
        return ctx;
      }
    } else {
      const m = matcher.exec(data);
      if (m) {
        const ctx = makeCtx({ ...ctxOverrides, match: m });
        await handler(ctx);
        return ctx;
      }
    }
  }
  throw new Error(`ни один action-хендлер не совпал с "${data}"`);
}

/** true, если callback_data не матчится ни на один зарегистрированный action. */
export function hasNoActionMatch(fakeBot: FakeBot, data: string): boolean {
  return !fakeBot.actions.some(({ matcher }) =>
    typeof matcher === 'string' ? matcher === data : matcher.test(data),
  );
}

// ── Самопроверка хелпера ────────────────────────────────────────────────────
// Матчинг регексов/строк здесь копирует поведение реального Telegraf — если
// сломается, все behavior-тесты src/telegram/*.spec.ts начнут врать молча.
describe('telegram.test-helpers — matching callback_data', () => {
  it('runAction находит хендлер по точной строке', async () => {
    const fakeBot = makeFakeBot();
    const handler = jest.fn();
    fakeBot.bot.action('foo:bar', handler);
    await runAction(fakeBot, 'foo:bar');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('runAction находит хендлер по regex и подставляет ctx.match', async () => {
    const fakeBot = makeFakeBot();
    const handler = jest.fn();
    fakeBot.bot.action(/^rate:(\w+):(\d+)$/, handler);
    const ctx = await runAction(fakeBot, 'rate:safety:7');
    expect(handler).toHaveBeenCalledTimes(1);
    expect(ctx.match[1]).toBe('safety');
    expect(ctx.match[2]).toBe('7');
  });

  it('runAction бросает, если ни один хендлер не совпал (мусорный callback_data)', async () => {
    const fakeBot = makeFakeBot();
    fakeBot.bot.action(/^rate:(\w+):(\d+)$/, jest.fn());
    await expect(runAction(fakeBot, 'rate:safety:abc')).rejects.toThrow(
      /ни один action-хендлер/,
    );
  });

  it('hasNoActionMatch согласован с runAction (один и тот же matcher)', async () => {
    const fakeBot = makeFakeBot();
    fakeBot.bot.action('known', jest.fn());
    expect(hasNoActionMatch(fakeBot, 'known')).toBe(false);
    expect(hasNoActionMatch(fakeBot, 'unknown')).toBe(true);
    await expect(runAction(fakeBot, 'known')).resolves.toBeDefined();
  });

  it('runCommand находит command-хендлер и бросает на незарегистрированном имени', async () => {
    const fakeBot = makeFakeBot();
    const handler = jest.fn();
    fakeBot.bot.command('start', handler);
    await runCommand(fakeBot, 'start');
    expect(handler).toHaveBeenCalledTimes(1);
    await expect(runCommand(fakeBot, 'ghost')).rejects.toThrow(
      /не зарегистрирован/,
    );
  });

  it('makeCtx даёт jest.fn() для всех методов, которые обычно дёргают хендлеры', () => {
    const ctx = makeCtx();
    expect(jest.isMockFunction(ctx.reply)).toBe(true);
    expect(jest.isMockFunction(ctx.editMessageText)).toBe(true);
    expect(jest.isMockFunction(ctx.answerCbQuery)).toBe(true);
  });
});

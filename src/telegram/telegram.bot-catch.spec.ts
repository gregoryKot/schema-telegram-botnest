// installBotCatch на настоящем Telegraf (handleUpdate, без сети): ошибка
// хендлера уходит в logger.error с типом апдейта, дальше не летит и не
// ставит process.exitCode. Контроль — тот же бот без installBotCatch:
// обработчик Telegraf по умолчанию пробрасывает ошибку и ставит exitCode = 1
// (так рвался поллинг, docs/open/ci-tests.md).
import { Telegraf, Context } from 'telegraf';
import type { Update, UserFromGetMe } from 'telegraf/types';
import { installBotCatch } from './telegram.bot-catch';

const BOT_INFO = {
  id: 1,
  is_bot: true,
  first_name: 'bot',
  username: 'test_bot',
} as UserFromGetMe;

const message = (update_id: number, text: string): Update => ({
  update_id,
  message: {
    message_id: update_id,
    date: Math.floor(Date.now() / 1000),
    chat: { id: 42, type: 'private', first_name: 'Т' },
    from: { id: 42, is_bot: false, first_name: 'Т' },
    text,
  },
});

const button = (update_id: number): Update => ({
  update_id,
  callback_query: {
    id: String(update_id),
    chat_instance: 'x',
    from: { id: 42, is_bot: false, first_name: 'Т' },
    data: 'boom:1',
  },
});

function makeBot(): { bot: Telegraf<Context>; handled: number[] } {
  const bot = new Telegraf<Context>('1:TEST');
  bot.botInfo = BOT_INFO; // handleUpdate не пойдёт за getMe в сеть
  const handled: number[] = [];
  bot.use((ctx, next) => {
    const text = (ctx.message as { text?: string } | undefined)?.text;
    if (text === 'boom' || ctx.callbackQuery) throw new Error('хендлер упал');
    handled.push(ctx.update.update_id);
    return next();
  });
  return { bot, handled };
}

describe('installBotCatch', () => {
  let exitCodeBefore: typeof process.exitCode;
  beforeEach(() => {
    exitCodeBefore = process.exitCode;
  });
  afterEach(() => {
    process.exitCode = exitCodeBefore;
  });

  it('хендлер бросает → logger.error с типом апдейта, ошибка дальше не летит, exitCode не тронут', async () => {
    const { bot, handled } = makeBot();
    const logger = { error: jest.fn() };
    installBotCatch(bot, logger);

    await expect(bot.handleUpdate(message(7, 'boom'))).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledTimes(1);
    const [text, stack] = logger.error.mock.calls[0] as [string, string];
    expect(text).toContain('message (update_id 7)');
    expect(text).toContain('хендлер упал');
    expect(text).not.toContain('boom'); // текст человека в лог не попадает
    expect(stack).toContain('Error: хендлер упал');
    expect(process.exitCode).toBe(exitCodeBefore);

    // Бот жив: следующий апдейт обрабатывается как обычно.
    await bot.handleUpdate(message(8, 'привет'));
    expect(handled).toEqual([8]);
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it('тип апдейта различает нажатия — ключ алерта не сливается с сообщениями', async () => {
    const { bot } = makeBot();
    const logger = { error: jest.fn() };
    installBotCatch(bot, logger);

    await bot.handleUpdate(button(9));
    expect(String(logger.error.mock.calls[0][0])).toContain(
      'callback_query (update_id 9)',
    );
  });

  it('не-Error из хендлера тоже логируется, без стека', async () => {
    const bot = new Telegraf<Context>('1:TEST');
    bot.botInfo = BOT_INFO;
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- нарочно не Error: ветка String(err)
    bot.use(() => Promise.reject('строка вместо ошибки'));
    const logger = { error: jest.fn() };
    installBotCatch(bot, logger);

    await bot.handleUpdate(message(10, 'x'));
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('строка вместо ошибки'),
      undefined,
    );
  });

  it('контроль: без installBotCatch Telegraf пробрасывает ошибку и ставит exitCode = 1', async () => {
    const { bot } = makeBot();
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    await expect(bot.handleUpdate(message(11, 'boom'))).rejects.toThrow(
      'хендлер упал',
    );
    expect(process.exitCode).toBe(1);
    consoleError.mockRestore();
  });
});

// /game: ссылка из бота несёт метку ?src=bot (иначе /stats считает «напрямую»),
// а сбой кнопки всё равно даёт человеку ссылку текстом.
import type { Context, Telegraf } from 'telegraf';
import { GAME_URL, registerGameCommand } from './game-command';

type Handler = (ctx: unknown) => Promise<void>;

function setup() {
  const handlers: Record<string, Handler> = {};
  const bot = {
    command: (name: string, h: Handler) => {
      handlers[name] = h;
    },
  } as unknown as Telegraf<Context>;
  const logger = { error: jest.fn() };
  registerGameCommand(bot, logger);
  return { handlers, logger };
}

describe('/game', () => {
  it('ссылка ведёт на игру с меткой ?src=bot', () => {
    expect(GAME_URL).toMatch(/\/game\/\?src=bot$/);
  });

  it('отвечает кнопкой на игру', async () => {
    const { handlers } = setup();
    const reply = jest.fn().mockResolvedValue(undefined);
    await handlers.game({ reply });
    const [, extra] = reply.mock.calls[0];
    expect(extra.reply_markup.inline_keyboard[0][0].url).toBe(GAME_URL);
  });

  it('кнопку отвергли — ссылка приходит текстом, сбой в логе', async () => {
    const { handlers, logger } = setup();
    const reply = jest
      .fn()
      .mockRejectedValueOnce(new Error('bad url'))
      .mockResolvedValue(undefined);
    await handlers.game({ reply });
    expect(logger.error).toHaveBeenCalled();
    expect(reply).toHaveBeenLastCalledWith(`🎮 Игра: ${GAME_URL}`);
  });
});

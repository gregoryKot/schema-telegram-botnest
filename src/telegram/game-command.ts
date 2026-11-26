// /game: ссылка на игру с меткой ?src=bot — блок «Игра» в /stats считает
// переход «из бота». Текст без обращения, поэтому формы ты/вы не нужны.
import type { Context, Telegraf } from 'telegraf';
import { APP_URL } from './telegram.constants';

export const GAME_URL = `${APP_URL}/game/?src=bot`;

export const GAME_TEXT =
  '🎮 <b>Сквозь голову. Неделя</b>\n\n' +
  'Пиксельная игра минут на пять: Саше к 15:00 к начальнице, а мир по дороге ' +
  'сбоит — так изнутри выглядит включившаяся схема. Привычные способы спасают ' +
  'ненадолго. Открывается в браузере, без регистрации.';

interface GameLogger {
  error(msg: string, err?: unknown): void;
}

export function registerGameCommand(
  bot: Telegraf<Context>,
  logger: GameLogger,
): void {
  bot.command('game', async (ctx) => {
    try {
      await ctx.reply(GAME_TEXT, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[{ text: '🎮 Играть', url: GAME_URL }]],
        },
      });
    } catch (err) {
      // Кнопку могли отвергнуть (кривой APP_URL) — ссылка текстом всё равно работает.
      logger.error('game command failed', err);
      await ctx.reply(`🎮 Игра: ${GAME_URL}`).catch(() => null);
    }
  });
}

import { Logger, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Telegraf } from 'telegraf';
import { Agent } from 'https';
import { TELEGRAF_BOT } from './telegram.constants';

const logger = new Logger('TelegramProviders');

/**
 * Клиент бота ходит в Telegram только по IPv4 и переиспользует соединение.
 *
 * Инцидент 2026-08-11: публикация в канал падала с ETIMEDOUT пятнадцать
 * попыток подряд, при этом сам бот отвечал на команды — то есть уже открытое
 * соединение опроса работало, а КАЖДОЕ НОВОЕ не устанавливалось. Так выглядит
 * битый маршрут IPv6: DNS отдаёт адреса обеих версий, Node берёт IPv6 первым и
 * упирается в тишину. `family: 4` убирает эту развилку, `keepAlive` — лишние
 * рукопожатия: пост уходит по уже живому соединению.
 */
export function telegramAgent(): Agent {
  return new Agent({ keepAlive: true, family: 4 });
}

export const TELEGRAM_PROVIDERS: Provider[] = [
  {
    provide: TELEGRAF_BOT,
    useFactory: async (config: ConfigService) => {
      const token = config.get<string>('BOT_TOKEN');
      if (!token) {
        logger.error('BOT_TOKEN is missing');
        throw new Error('Invalid BOT_TOKEN');
      }

      const bot = new Telegraf(token, {
        telegram: { agent: telegramAgent() },
      });
      try {
        const me = await bot.telegram.getMe();
        logger.log(`Bot authorized: @${me.username ?? me.id}`);
      } catch (err) {
        // Network unreachable at startup (e.g. Amvera → Telegram timeout).
        // Return the bot anyway — it will retry on the first update or launch().
        logger.warn(
          `getMe failed at startup (bot may recover): ${(err as Error).message}`,
        );
      }
      return bot;
    },
    inject: [ConfigService],
  },
];

import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Telegraf } from 'telegraf';
import { TELEGRAF_BOT } from './telegram.constants';

/**
 * Provider that creates a Telegraf bot instance using BOT_TOKEN from env/config.
 * Validates the token by calling `getMe()` and logs authorization state.
 * Throws an error when token is missing or invalid to stop bootstrap.
 */
export const TELEGRAM_PROVIDERS: Provider[] = [
  {
    provide: TELEGRAF_BOT,
    useFactory: async (config: ConfigService) => {
      const token = config.get<string>('BOT_TOKEN');
      if (!token) {
        console.error('[TELEGRAM] Invalid BOT_TOKEN');
        throw new Error('Invalid BOT_TOKEN');
      }

      const bot = new Telegraf(token);

      // Validate token by calling getMe(); let error propagate on failure
      const me = await bot.telegram.getMe();
      const username = me.username ?? (me.first_name ? `${me.first_name}` : `${me.id}`);
      console.log(`[TELEGRAM] Bot authorized: @${me.username ?? username}`);

      return bot;
    },
    inject: [ConfigService],
  },
];

import { Logger, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Telegraf } from 'telegraf';
import { TELEGRAF_BOT } from './telegram.constants';

const logger = new Logger('TelegramProviders');

export const TELEGRAM_PROVIDERS: Provider[] = [
  {
    provide: TELEGRAF_BOT,
    useFactory: async (config: ConfigService) => {
      const token = config.get<string>('BOT_TOKEN');
      if (!token) {
        logger.error('BOT_TOKEN is missing');
        throw new Error('Invalid BOT_TOKEN');
      }

      const bot = new Telegraf(token);
      const me = await bot.telegram.getMe();
      logger.log(`Bot authorized: @${me.username ?? me.id}`);

      return bot;
    },
    inject: [ConfigService],
  },
];

import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Telegraf, Context } from 'telegraf';
import { TELEGRAF_BOT } from './telegram.constants';
import { pickHealthyAdultPhrase } from '../bot/healthy-adult.data';

/** Часовой пояс расписания канала (единый для broadcast, не per-user). */
const POST_TZ = 'Europe/Moscow';
const MORNING_CRON = '0 9 * * *';
const EVENING_CRON = '0 20 * * *';

/**
 * Публикация фраз «Здорового Взрослого» в отдельный Telegram-канал пару раз
 * в день. Канал задаётся env `HEALTHY_ADULT_CHANNEL` (@username или -100…id);
 * без него фича выключена — ничего не постим (безопасный дефолт, чтобы не
 * спамить основной канал). Бизнес-логика выбора фразы — в bot/healthy-adult.data.
 *
 * Аналитика: охват/подписчики канала измеряются штатной статистикой Telegram,
 * не нашей БД (пост не привязан к userId). Каждый пост пишем в лог для трейсинга.
 */
@Injectable()
export class TelegramChannelService {
  private readonly logger = new Logger(TelegramChannelService.name);

  constructor(
    @Inject(TELEGRAF_BOT)
    @Optional()
    private readonly bot: Telegraf<Context> | null,
  ) {}

  /** Целевой канал из env (null → фича выключена). */
  private channel(): string | null {
    const raw = process.env.HEALTHY_ADULT_CHANNEL?.trim();
    return raw ? raw : null;
  }

  @Cron(MORNING_CRON, { name: 'healthyAdultMorning', timeZone: POST_TZ })
  async postMorning() {
    await this.post(0);
  }

  @Cron(EVENING_CRON, { name: 'healthyAdultEvening', timeZone: POST_TZ })
  async postEvening() {
    await this.post(1);
  }

  /** Опубликовать фразу для слота (0 = утро, 1 = вечер). */
  async post(slot: number): Promise<void> {
    const channel = this.channel();
    if (!this.bot || !channel) return;

    const phrase = pickHealthyAdultPhrase(new Date(), slot);
    try {
      await this.bot.telegram.sendMessage(channel, phrase, {
        disable_notification: true,
      });
      this.logger.log(`healthy_adult_post slot=${slot} channel=${channel}`);
    } catch (err) {
      this.logger.error(
        `Failed to post healthy-adult phrase (slot=${slot}, channel=${channel})`,
        err as Error,
      );
    }
  }
}

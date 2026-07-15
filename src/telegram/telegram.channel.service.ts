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

  /**
   * Опубликовать фразу для слота (0 = утро, 1 = вечер). Возвращает статус для
   * диагностики (крон игнорирует, админ-команда /zv показывает): выключенная
   * фича и ошибка отправки различимы, чтобы было видно, дошёл ли пост.
   */
  async post(slot: number): Promise<{ ok: boolean; message: string }> {
    const channel = this.channel();
    if (!channel) {
      return {
        ok: false,
        message: '⚠️ HEALTHY_ADULT_CHANNEL не задан — постинг выключен.',
      };
    }
    if (!this.bot) {
      return {
        ok: false,
        message: '⚠️ Бот не инициализирован (нет BOT_TOKEN?).',
      };
    }

    const phrase = pickHealthyAdultPhrase(new Date(), slot);
    try {
      await this.bot.telegram.sendMessage(channel, phrase);
      this.logger.log(`healthy_adult_post slot=${slot} channel=${channel}`);
      return {
        ok: true,
        message: `✅ Опубликовано в ${channel}:\n\n${phrase}`,
      };
    } catch (err) {
      // Телеграм кладёт причину в err.response.description; типобезопасно
      // достаём её без каста на any (правило №9), с фолбэком на message/строку.
      const resp =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { description?: string } }).response
          : undefined;
      const desc =
        resp?.description ?? (err instanceof Error ? err.message : String(err));
      this.logger.error(
        `Failed to post healthy-adult phrase (slot=${slot}, channel=${channel}): ${desc}`,
      );
      return {
        ok: false,
        message: `❌ Не удалось опубликовать в ${channel}: ${desc}\n\nПроверь, что бот — администратор канала с правом публикации.`,
      };
    }
  }
}

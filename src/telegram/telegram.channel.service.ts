import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Telegraf, Context } from 'telegraf';
import { TELEGRAF_BOT } from './telegram.constants';
import { HealthyAdultService } from '../bot/healthy-adult.service';
import { HealthyAdultGeneratorService } from '../bot/healthy-adult.generator';

/** Часовой пояс расписания канала (единый для broadcast, не per-user). */
const POST_TZ = 'Europe/Moscow';
const MORNING_CRON = '0 9 * * *';
const EVENING_CRON = '0 20 * * *';

/**
 * Публикация сообщений «Здорового Взрослого» в Telegram-канал дважды в день.
 * Гибрид (по решению владельца): сначала генерация через Claude API, при сбое
 * или без ключа — фраза из пула (LRU, без повторов подряд). Каждый пост пишем
 * в лог HealthyAdultPost — для дедупа и как контекст следующей генерации.
 *
 * Канал задаётся env `HEALTHY_ADULT_CHANNEL` (@username или -100…id); без него
 * фича выключена (безопасный дефолт, чтобы не спамить основной канал).
 */
@Injectable()
export class TelegramChannelService {
  private readonly logger = new Logger(TelegramChannelService.name);

  constructor(
    @Inject(TELEGRAF_BOT)
    @Optional()
    private readonly bot: Telegraf<Context> | null,
    private readonly phrases: HealthyAdultService,
    private readonly generator: HealthyAdultGeneratorService,
  ) {}

  /** Целевой канал из env (null → фича выключена). */
  private channel(): string | null {
    const raw = process.env.HEALTHY_ADULT_CHANNEL?.trim();
    return raw ? raw : null;
  }

  @Cron(MORNING_CRON, { name: 'healthyAdultMorning', timeZone: POST_TZ })
  async postMorning() {
    await this.post();
  }

  @Cron(EVENING_CRON, { name: 'healthyAdultEvening', timeZone: POST_TZ })
  async postEvening() {
    await this.post();
  }

  /**
   * Опубликовать одно сообщение сейчас. Возвращает статус для диагностики
   * (крон игнорирует, /zv и админка показывают): выключенная фича, пустой пул
   * и ошибка отправки различимы, чтобы было видно, дошёл ли пост.
   */
  async post(): Promise<{ ok: boolean; message: string }> {
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

    const recent = await this.phrases.recentPostTexts(10);
    let text = await this.generator.generate(recent);
    let source: 'ai' | 'pool' = 'ai';
    if (!text) {
      text = await this.phrases.pickFromPool(recent);
      source = 'pool';
    }
    if (!text) {
      return {
        ok: false,
        message: '⚠️ Нет активных фраз и генерация недоступна — добавь фразу.',
      };
    }

    try {
      await this.bot.telegram.sendMessage(channel, text);
      await this.phrases.recordPost(text, source);
      this.logger.log(`healthy_adult_post source=${source} channel=${channel}`);
      return {
        ok: true,
        message: `✅ Опубликовано в ${channel} (${source}):\n\n${text}`,
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
        `Failed to post healthy-adult message (channel=${channel}): ${desc}`,
      );
      return {
        ok: false,
        message: `❌ Не удалось опубликовать в ${channel}: ${desc}\n\nПроверь, что бот — администратор канала с правом публикации.`,
      };
    }
  }
}

import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Telegraf, Context } from 'telegraf';
import { TELEGRAF_BOT } from './telegram.constants';
import { HealthyAdultService } from '../bot/healthy-adult.service';
import { poolAlertText } from '../bot/healthy-adult.pool-alert';
import { dueSlot, mskParts } from '../bot/healthy-adult.schedule';
import { SlotAttempts } from '../bot/healthy-adult.attempts';
import { describeTelegramError } from './telegram-error';
import { notifyAdminWithFallback } from '../utils/admin-alert';

/** Часовой пояс расписания канала (единый для broadcast, не per-user). */
const POST_TZ = 'Europe/Moscow';
// Тики каждые 5 минут внутри окон 09:00–10:55 и 18:00–19:55 МСК. Публикует не
// каждый тик — а один раз за окно, в детерминированно-случайную минуту (jitter,
// см. healthy-adult.schedule): время гуляет ото дня ко дню, но переживает
// рестарт — setTimeout-задержка потерялась бы при деплое.
const MORNING_CRON = '*/5 9,10 * * *';
const EVENING_CRON = '*/5 18,19 * * *';

/** Статус публикации: крон решает по нему, алертить ли; /zv и админка — показывают. */
export interface PostResult {
  ok: boolean;
  message: string;
}
const fail = (message: string): PostResult => ({
  ok: false,
  message: `⚠️ ${message}`,
});

/**
 * Публикация сообщений «Здорового Взрослого» в Telegram-канал дважды в день —
 * утром (~10:00 ±час) и вечером (~19:00 ±час), в случайную минуту, чтобы не
 * выглядеть ботом. Фраза берётся из пула (LRU, без повторов подряд), пул
 * пополняется пачками через админку — см. HEALTHY_ADULT.md. Генерации на лету
 * нет намеренно: в канал уходит только то, что владелец прочитал глазами.
 * Каждый пост пишем в HealthyAdultPost — для дедупа и истории.
 *
 * Канал задаётся env `HEALTHY_ADULT_CHANNEL` (@username или -100…id); без него
 * фича выключена (безопасный дефолт, чтобы не спамить основной канал).
 */
@Injectable()
export class TelegramChannelService {
  private readonly logger = new Logger(TelegramChannelService.name);
  private readonly attempts = new SlotAttempts();

  constructor(
    @Inject(TELEGRAF_BOT)
    @Optional()
    private readonly bot: Telegraf<Context> | null,
    private readonly phrases: HealthyAdultService,
  ) {}

  /** Целевой канал из env (null → фича выключена). */
  private channel(): string | null {
    const raw = process.env.HEALTHY_ADULT_CHANNEL?.trim();
    return raw ? raw : null;
  }

  @Cron(MORNING_CRON, { name: 'healthyAdultMorning', timeZone: POST_TZ })
  async tickMorning() {
    await this.maybePost();
  }

  @Cron(EVENING_CRON, { name: 'healthyAdultEvening', timeZone: POST_TZ })
  async tickEvening() {
    await this.maybePost();
  }

  /**
   * Тик расписания: публикует, только если настала запланированная минута слота
   * и в этот слот ещё не постили (ручная публикация из админки и /zv идёт мимо,
   * через post()). Неудача не пишется как пост, поэтому следующий тик попробует
   * снова — но не бесконечно: три попытки на слот и одно сообщение админу, когда
   * они кончились (инцидент 2026-07-29: 24 одинаковых DM за утро).
   */
  async maybePost(now = new Date()): Promise<void> {
    try {
      const slot = dueSlot(now, await this.phrases.lastPostAt());
      if (!slot) return;
      const key = `${mskParts(now).dateKey}:${slot}`;
      if (!this.attempts.allow(key)) return;
      const res = await this.post();
      if (res.ok) return void this.attempts.reset(key);
      const { attempt, exhausted } = this.attempts.fail(key);
      const line = `healthy-adult ${slot}: попытка ${attempt} не удалась — ${res.message}`;
      // Админа будим один раз — когда стало ясно, что само не починится.
      if (exhausted) this.logger.error(line);
      else this.logger.warn(line);
    } catch (err) {
      this.logger.error(
        `healthy-adult tick failed: ${(err as Error)?.message}`,
      );
    }
  }

  /**
   * Опубликовать одно сообщение сейчас. Выключенная фича, пустой пул и ошибка
   * отправки различимы в статусе — чтобы было видно, дошёл ли пост.
   */
  async post(): Promise<PostResult> {
    const channel = this.channel();
    if (!channel)
      return fail('HEALTHY_ADULT_CHANNEL не задан — постинг выключен.');
    if (!this.bot) return fail('Бот не инициализирован (нет BOT_TOKEN?).');

    const recent = await this.phrases.recentPostTexts(10);
    const text = await this.phrases.pickFromPool(recent);
    if (!text)
      return fail(
        'Нет активных фраз — добавь их в админке (вкладка «Канал ЗВ»).',
      );

    try {
      await this.bot.telegram.sendMessage(channel, text);
      await this.phrases.recordPost(text, 'pool');
      this.logger.log(`healthy_adult_post channel=${channel}`);
      // Пул конечен — предупреждаем владельца заранее, а не когда канал начнёт
      // повторяться (пороги внутри, спама не будет). Сбой этой побочной
      // проверки не должен превращать отправленный пост в «не опубликовано».
      const alert = await this.phrases
        .poolStatus()
        .then(poolAlertText)
        .catch(() => null);
      if (alert) await notifyAdminWithFallback(alert, 'Пул канала ЗВ');
      return { ok: true, message: `✅ Опубликовано в ${channel}:\n\n${text}` };
    } catch (err) {
      // Причина — общим разборщиком: ответ API («400: chat not found») или код
      // транспорта («ETIMEDOUT»), иначе алерт обрывался на «reason:». warn, а не
      // error: будить ли админа, решает maybePost — иначе каждый тик = свой DM.
      const desc = describeTelegramError(err);
      this.logger.warn(
        `Failed to post healthy-adult message (channel=${channel}): ${desc}`,
      );
      const hint =
        'Проверь, что бот — администратор канала с правом публикации.';
      return { ok: false, message: `❌ ${channel}: ${desc}\n\n${hint}` };
    }
  }
}

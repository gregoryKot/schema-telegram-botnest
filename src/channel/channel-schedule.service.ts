import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { HealthyAdultService } from '../bot/healthy-adult.service';
import {
  dueSlot,
  mskParts,
  type HealthyAdultSlot,
} from '../bot/healthy-adult.schedule';
import { notifyAdminWithFallback } from '../utils/admin-alert';
import { SlotAttempts } from '../bot/healthy-adult.attempts';
import { ChannelPublisherService } from './channel-publisher.service';
import { failedSummary, silentSummary } from './publish-report';

/** Часовой пояс расписания канала (единый для broadcast, не per-user). */
const POST_TZ = 'Europe/Moscow';
// Тики каждые 5 минут внутри окон 09:00–10:55 и 18:00–19:55 МСК. Публикует не
// каждый тик — а один раз за окно, в детерминированно-случайную минуту (jitter,
// см. healthy-adult.schedule): время гуляет ото дня ко дню, но переживает
// рестарт — setTimeout-задержка потерялась бы при деплое.
const MORNING_CRON = '*/5 9,10 * * *';
const EVENING_CRON = '*/5 18,19 * * *';
/** Имя слота для владельца и для журнала отправок. */
const SLOT_NAME: Record<HealthyAdultSlot, string> = {
  morning: 'утро',
  evening: 'вечер',
};

/**
 * Когда каналу «Здоровый Взрослый» пора говорить: дважды в день, утром
 * (~10:00 ±час) и вечером (~19:00 ±час), в случайную минуту, чтобы не выглядеть
 * ботом. Что именно и куда уходит — дело ChannelPublisherService: этот сервис
 * решает только «пора / не пора / хватит пробовать».
 */
@Injectable()
export class ChannelScheduleService {
  private readonly logger = new Logger(ChannelScheduleService.name);
  private readonly attempts = new SlotAttempts();

  constructor(
    private readonly publisher: ChannelPublisherService,
    private readonly phrases: HealthyAdultService,
  ) {}

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
   * через publisher.publish()). Полная неудача не пишется как пост, поэтому
   * следующий тик попробует снова — но не бесконечно: три попытки на слот и
   * одно сообщение владельцу, когда они кончились (инцидент 2026-07-29: 24
   * одинаковых DM за утро).
   */
  async maybePost(now = new Date()): Promise<void> {
    try {
      const slot = dueSlot(now, await this.phrases.lastPostAt());
      if (!slot) return;
      const key = `${mskParts(now).dateKey}:${slot}`;
      if (!this.attempts.allow(key)) return;

      const res = await this.publisher.publish(SLOT_NAME[slot]);
      if (res.posted) {
        this.attempts.reset(key);
        // Частичный успех: слот закрыт (повтор дал бы дубль там, где пост уже
        // вышел), но про упавшую площадку владелец должен узнать — один раз.
        if (res.failed.length > 0 || res.silent.length > 0)
          await this.alert(
            `Канал ЗВ (${SLOT_NAME[slot]}): дошло не везде\n` +
              `${failedSummary(res.failed)}${silentSummary(res.silent)}`,
          );
        return;
      }

      const { attempt, exhausted } = this.attempts.fail(key);
      // Владельца будим один раз — когда стало ясно, что само не починится.
      if (exhausted)
        await this.alert(
          `Канал ЗВ (${SLOT_NAME[slot]}): не вышло ничего\n${res.message}`,
        );
      else
        this.logger.warn(
          `healthy-adult ${slot}: попытка ${attempt} не удалась — ${res.message}`,
        );
    } catch (err) {
      this.logger.error(
        `healthy-adult tick failed: ${(err as Error)?.message}`,
      );
    }
  }

  /**
   * Сообщение владельцу — напрямую, а не через `logger.error` → AlertLogger.
   * Инцидент 2026-07-31: пост вышел не на все площадки, а DM не пришёл. На
   * пути этого сообщения стояло лишнее звено с собственным троттлингом по
   * нормализованному тексту, обрезкой до 300 символов и молчаливым
   * проглатыванием ошибок. Алерт о канале слишком редкий, чтобы его троттлить.
   */
  private async alert(text: string): Promise<void> {
    // warn, а не error: DM уходит явной строкой ниже, дублировать не нужно.
    this.logger.warn(text);
    await notifyAdminWithFallback(text, 'Канал «Здоровый Взрослый»');
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { HealthyAdultService } from '../bot/healthy-adult.service';
import { dueSlot, mskParts } from '../bot/healthy-adult.schedule';
import { SlotAttempts } from '../bot/healthy-adult.attempts';
import { ChannelPublisherService } from './channel-publisher.service';
import { failedSummary } from './publish-report';

/** Часовой пояс расписания канала (единый для broadcast, не per-user). */
const POST_TZ = 'Europe/Moscow';
// Тики каждые 5 минут внутри окон 09:00–10:55 и 18:00–19:55 МСК. Публикует не
// каждый тик — а один раз за окно, в детерминированно-случайную минуту (jitter,
// см. healthy-adult.schedule): время гуляет ото дня ко дню, но переживает
// рестарт — setTimeout-задержка потерялась бы при деплое.
const MORNING_CRON = '*/5 9,10 * * *';
const EVENING_CRON = '*/5 18,19 * * *';

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

      const res = await this.publisher.publish();
      if (res.posted) {
        this.attempts.reset(key);
        // Частичный успех: слот закрыт (повтор дал бы дубль там, где пост уже
        // вышел), но про упавшую площадку владелец должен узнать — один раз.
        if (res.failed.length > 0)
          this.logger.error(
            `healthy-adult ${slot}: дошло не везде\n${failedSummary(res.failed)}`,
          );
        return;
      }

      const { attempt, exhausted } = this.attempts.fail(key);
      const line = `healthy-adult ${slot}: попытка ${attempt} не удалась — ${res.message}`;
      // Владельца будим один раз — когда стало ясно, что само не починится.
      if (exhausted) this.logger.error(line);
      else this.logger.warn(line);
    } catch (err) {
      this.logger.error(
        `healthy-adult tick failed: ${(err as Error)?.message}`,
      );
    }
  }
}

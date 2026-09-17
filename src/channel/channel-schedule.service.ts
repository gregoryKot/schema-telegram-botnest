import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { HealthyAdultService } from '../bot/healthy-adult.service';
import {
  catchUpSlot,
  dueSlot,
  mskParts,
  type HealthyAdultSlot,
} from '../bot/healthy-adult.schedule';
import { DeliveryLogService } from './delivery-log.service';
import { planRetry } from './retry-plan';
import { notifyAdminWithFallback } from '../utils/admin-alert';
import { SlotAttempts } from '../bot/healthy-adult.attempts';
import { ChannelPublisherService } from './channel-publisher.service';
import { failedSummary, silentSummary } from './publish-report';
import { CronLeaderService, LEASE_WINDOW } from '../infra/cron-leader.service';

/** Часовой пояс расписания канала (единый для broadcast, не per-user). */
const POST_TZ = 'Europe/Moscow';
// Тики каждые 5 минут внутри окон 09:00–10:55 и 18:00–19:55 МСК. Публикует не
// каждый тик — а один раз за окно, в детерминированно-случайную минуту (jitter,
// см. healthy-adult.schedule): время гуляет ото дня ко дню, но переживает
// рестарт — setTimeout-задержка потерялась бы при деплое.
const MORNING_CRON = '*/5 9,10 * * *';
/**
 * Досылка долга — своим тиком, шире окна публикации. Пост, вышедший на
 * последнем тике окна, иначе оставался бы недосланным: повторять было уже
 * нечем (инцидент 2026-08-09).
 */
const CATCH_UP_CRON = '*/15 * * * *';
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

  /** Счётчик попыток досылки — свой, чтобы не жечь попытки самой публикации. */
  private readonly retries = new SlotAttempts();

  constructor(
    private readonly publisher: ChannelPublisherService,
    private readonly phrases: HealthyAdultService,
    private readonly deliveries: DeliveryLogService,
    private readonly cronLeader: CronLeaderService,
  ) {}

  @Cron(MORNING_CRON, { name: 'healthyAdultMorning', timeZone: POST_TZ })
  async tickMorning() {
    // Без аренды второй инстанс (масштабирование/рестарт) продублирует пост
    // подписчикам канала в то же окно — один и тот же слот выйдет дважды.
    if (
      !(await this.cronLeader.claimRun(
        'healthyAdultMorning',
        LEASE_WINDOW.fiveMinutes,
      ))
    )
      return;
    await this.maybePost();
  }

  @Cron(EVENING_CRON, { name: 'healthyAdultEvening', timeZone: POST_TZ })
  async tickEvening() {
    // Тот же риск, что и у утреннего тика, но для вечернего окна.
    if (
      !(await this.cronLeader.claimRun(
        'healthyAdultEvening',
        LEASE_WINDOW.fiveMinutes,
      ))
    )
      return;
    await this.maybePost();
  }

  @Cron(CATCH_UP_CRON, { name: 'healthyAdultCatchUp', timeZone: POST_TZ })
  async tickCatchUp() {
    // Без аренды оба инстанса досылают долг одним и тем же должникам —
    // повторный retry() по уже дошедшей площадке превращается в дубль поста.
    if (
      !(await this.cronLeader.claimRun(
        'healthyAdultCatchUp',
        LEASE_WINDOW.fifteenMinutes,
      ))
    )
      return;
    try {
      await this.catchUp(new Date());
    } catch (err) {
      this.logger.error(
        `healthy-adult catch-up failed: ${(err as Error)?.message}`,
      );
    }
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
      // Слот закрыт — но пост мог выйти не везде: досылаем долг адресно.
      if (!slot) return void (await this.catchUp(now));
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
              `${failedSummary(res.failed)}${silentSummary(res.silent)}` +
              (res.failed.length > 0
                ? '\nПробую дослать в ближайшие минуты.'
                : ''),
            res.failed,
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
   * Досылка тем площадкам, которые пост этого слота не приняли.
   *
   * До 2026-08 частичный успех означал пропуск: слот закрывался, и упавшая
   * площадка теряла публикацию до следующего слота с другой фразой. Повторять
   * весь фан-аут нельзя — это дубль там, где пост уже вышел, — поэтому долг
   * считается по журналу и досылается только должникам.
   */
  private async catchUp(now: Date): Promise<void> {
    const slot = catchUpSlot(now);
    if (!slot) return;
    const key = `${mskParts(now).dateKey}:${slot}:повтор`;
    if (!this.retries.allow(key)) return;

    const name = SLOT_NAME[slot];
    // Окно слота длится два часа, поэтому трёх часов назад заведомо хватает.
    const since = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const plan = planRetry(await this.deliveries.slotRows(name, since));
    if (!plan) return;

    const res = await this.publisher.retry(name, plan.text, plan.platforms);
    if (res.ok) {
      this.retries.reset(key);
      // Хорошая новость закрывает историю: владелец уже получил «дошло не
      // везде» и иначе остался бы с ней наедине.
      await this.alert(
        `Канал ЗВ (${name}): досталось со второй попытки — ${plan.platforms.join(', ')}.`,
      );
      return;
    }
    this.retries.fail(key);
    this.logger.warn(
      `healthy-adult ${slot}: повтор не удался — ${res.message}`,
    );
  }

  /**
   * Сообщение владельцу — напрямую, а не через `logger.error` → AlertLogger.
   * Инцидент 2026-07-31: пост вышел не на все площадки, а DM не пришёл. На
   * пути этого сообщения стояло лишнее звено с собственным троттлингом по
   * нормализованному тексту, обрезкой до 300 символов и молчаливым
   * проглатыванием ошибок. Алерт о канале слишком редкий, чтобы его троттлить.
   */
  private async alert(
    text: string,
    failed: { platform: string }[] = [],
  ): Promise<void> {
    // warn, а не error: DM уходит явной строкой ниже, дублировать не нужно.
    this.logger.warn(text);
    // Если упал сам Telegram, DM пойдёт тем же путём, который не работает —
    // сообщение о недоступности Telegram по Telegram не доставить (инцидент
    // 2026-08-09: сбои шли три дня, а владелец не знал). Тогда сразу почтой.
    const telegramDown = failed.some((f) => f.platform === 'telegram');
    await notifyAdminWithFallback(text, 'Канал «Здоровый Взрослый»', {
      skipTelegram: telegramDown,
    });
  }
}

import { Inject, Injectable, Logger } from '@nestjs/common';
import { HealthyAdultService } from '../bot/healthy-adult.service';
import { poolAlertText } from '../bot/healthy-adult.pool-alert';
import { notifyAdminWithFallback } from '../utils/admin-alert';
import {
  CHANNEL_TARGETS,
  type ChannelTarget,
  type Delivery,
  type DeliveryFailure,
  type PublishResult,
} from './channel-target';
import { allDisabled, emptyPool, fanoutResult } from './publish-report';

/** Сколько последних постов показываем пулу, чтобы не повториться подряд. */
const RECENT_POSTS = 10;

/**
 * Рассылка одного сообщения «Здорового Взрослого» по всем включённым
 * площадкам. Фраза выбирается из пула ОДИН раз на публикацию и уходит везде
 * одинаковой: иначе каждая площадка тянула бы свою, LRU-пул выгорал бы вдвое
 * быстрее, а дедуп по последним постам перестал бы работать.
 *
 * Запись в HealthyAdultPost — тоже одна на публикацию, а не по площадке: по
 * ней считается «когда постили в последний раз» для расписания и «что уже
 * звучало» для дедупа, и оба ответа не зависят от числа площадок.
 *
 * Пул конечен и пополняется вручную — см. HEALTHY_ADULT.md.
 */
@Injectable()
export class ChannelPublisherService {
  private readonly logger = new Logger(ChannelPublisherService.name);

  constructor(
    @Inject(CHANNEL_TARGETS) private readonly targets: ChannelTarget[],
    private readonly phrases: HealthyAdultService,
  ) {}

  /** Площадки, у которых задан env. Ненастроенные молчат, а не падают. */
  private enabled(): { target: ChannelTarget; destination: string }[] {
    return this.targets.flatMap((target) => {
      const destination = target.destination();
      return destination ? [{ target, destination }] : [];
    });
  }

  /** Опубликовать одну фразу сейчас: /zv, кнопка в админке, тик расписания. */
  async publish(): Promise<PublishResult> {
    const enabled = this.enabled();
    if (enabled.length === 0) return allDisabled(this.targets);

    const recent = await this.phrases.recentPostTexts(RECENT_POSTS);
    const text = await this.phrases.pickFromPool(recent);
    if (!text) return emptyPool();

    const delivered: Delivery[] = [];
    const failed: DeliveryFailure[] = [];
    // Площадки независимы: медленная или упавшая не задерживает остальные.
    await Promise.all(
      enabled.map(async ({ target, destination }) => {
        const outcome = await this.deliver(target, destination, text);
        if ('reason' in outcome) failed.push(outcome);
        else delivered.push(outcome);
      }),
    );

    if (delivered.length > 0) await this.afterPost(text);
    return fanoutResult(text, delivered, failed);
  }

  private async deliver(
    target: ChannelTarget,
    destination: string,
    text: string,
  ): Promise<Delivery | DeliveryFailure> {
    const where = {
      platform: target.platform,
      title: target.title,
      destination,
    };
    try {
      await target.send(text, destination);
      this.logger.log(`healthy_adult_post ${target.platform}=${destination}`);
      return where;
    } catch (err) {
      const reason = target.explain(err);
      // warn, а не error: будить ли владельца, решает расписание — иначе
      // каждый тик крона превращался бы в отдельный DM (инцидент 2026-07-29).
      this.logger.warn(`healthy-adult ${target.platform} failed: ${reason}`);
      return { ...where, reason };
    }
  }

  /** Побочные дела после удачной отправки: они не отменяют уже вышедший пост. */
  private async afterPost(text: string): Promise<void> {
    await this.phrases
      .recordPost(text, 'pool')
      .catch((err: Error) =>
        this.logger.error(`healthy-adult recordPost failed: ${err?.message}`),
      );
    const alert = await this.phrases
      .poolStatus()
      .then(poolAlertText)
      .catch(() => null);
    if (alert) await notifyAdminWithFallback(alert, 'Пул канала ЗВ');
  }
}

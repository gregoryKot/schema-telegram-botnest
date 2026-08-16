import { Inject, Injectable, Logger } from '@nestjs/common';
import { HealthyAdultService } from '../bot/healthy-adult.service';
import { poolAlertText } from '../bot/healthy-adult.pool-alert';
import { notifyAdminWithFallback } from '../utils/admin-alert';
import {
  CHANNEL_TARGETS,
  type ChannelPost,
  type ChannelTarget,
  type Delivery,
  type DeliveryFailure,
  type PublishResult,
  type SilentTarget,
} from './channel-target';
import { DeliveryLogService } from './delivery-log.service';
import { allDisabled, emptyPool, fanoutResult } from './publish-report';
import { makeChannelPost } from './pin-image';

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
    private readonly deliveries: DeliveryLogService,
  ) {}

  /** Площадки, у которых задан env. Ненастроенные молчат, а не падают. */
  private enabled(): { target: ChannelTarget; destination: string }[] {
    return this.targets.flatMap((target) => {
      const destination = target.destination();
      return destination ? [{ target, destination }] : [];
    });
  }

  /** Площадки без env — их называем в отчёте, иначе молчание сойдёт за успех. */
  private silent(): SilentTarget[] {
    return this.targets
      .filter((t) => !t.destination())
      .map((t) => ({ title: t.title, envKey: t.envKey }));
  }

  /**
   * Опубликовать одну фразу сейчас: /zv, кнопка в админке, тик расписания.
   * `source` попадает в журнал отправок — по нему потом видно, чья это была
   * публикация: утренняя, вечерняя или ручная.
   */
  async publish(source = 'вручную'): Promise<PublishResult> {
    const enabled = this.enabled();
    if (enabled.length === 0) return allDisabled(this.targets);

    const recent = await this.phrases.recentPostTexts(RECENT_POSTS);
    const text = await this.phrases.pickFromPool(recent);
    if (!text) return emptyPool();

    const post = makeChannelPost(text);
    const delivered: Delivery[] = [];
    const failed: DeliveryFailure[] = [];
    // Площадки независимы: медленная или упавшая не задерживает остальные.
    await Promise.all(
      enabled.map(async ({ target, destination }) => {
        const outcome = await this.deliver(target, destination, post);
        if ('reason' in outcome) failed.push(outcome);
        else delivered.push(outcome);
      }),
    );

    // Журнал пишем всегда — и когда дошло, и когда нет: он и есть ответ на
    // «почему утром пришло не везде» и основа адресного повтора.
    await this.deliveries.record(source, delivered, failed, text);
    if (delivered.length > 0) await this.afterPost(text);
    return fanoutResult(text, delivered, failed, this.silent());
  }

  /**
   * Досылка той же фразы тем площадкам, которые её не приняли.
   *
   * Пул не трогаем и пост в историю не пишем: публикация уже состоялась, это
   * добор долга внутри того же слота. Повтор всего фан-аута дал бы дубль там,
   * где пост уже вышел, поэтому список площадок приходит снаружи — из журнала.
   */
  async retry(
    source: string,
    text: string,
    platforms: string[],
  ): Promise<PublishResult> {
    const wanted = new Set(platforms);
    const targets = this.enabled().filter(({ target }) =>
      wanted.has(target.platform),
    );
    if (targets.length === 0) return fanoutResult(text, [], []);

    const post = makeChannelPost(text);
    const delivered: Delivery[] = [];
    const failed: DeliveryFailure[] = [];
    await Promise.all(
      targets.map(async ({ target, destination }) => {
        const outcome = await this.deliver(target, destination, post);
        if ('reason' in outcome) failed.push(outcome);
        else delivered.push(outcome);
      }),
    );
    await this.deliveries.record(`${source} — повтор`, delivered, failed, text);
    return fanoutResult(text, delivered, failed);
  }

  private async deliver(
    target: ChannelTarget,
    destination: string,
    post: ChannelPost,
  ): Promise<Delivery | DeliveryFailure> {
    const where = {
      platform: target.platform,
      title: target.title,
      destination,
    };
    try {
      await target.send(post, destination);
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
      .catch((err: Error) => {
        this.logger.error(`healthy-adult poolStatus failed: ${err?.message}`);
        return null;
      });
    if (alert) await notifyAdminWithFallback(alert, 'Пул канала ЗВ');
  }
}

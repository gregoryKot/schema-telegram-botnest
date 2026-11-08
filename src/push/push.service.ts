// Уведомления в приложении (веб-пуши, docs/PWA_PLAN.md «Фаза 4»): подписки
// браузеров и отправка в них. Канал выбирает очередь уведомлений
// (telegram.schedule-queue.ts → notify-channel.ts): есть подписка — сюда,
// иначе Telegram. Нет VAPID-ключей — сервис выключен целиком (push-config.ts).
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { sendNotification } from 'web-push';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';
import type { PushUnsubscribeReason } from '../analytics/push-events.constants';
import { vapidState, type VapidState } from './push-config';
import { checkPushEndpoint, pushServiceOf } from './push-endpoint';
import { attemptPush, type PushAttempt, type SendFn } from './push-transport';
import { PUSH_TITLE, type PushPayload } from './push-payload';
import {
  deleteOwnSubscription,
  deleteSubscription,
  saveSubscription,
  subscribedUserIds,
  subscriptionsOf,
  type PushKeys,
  type StoredPush,
} from './push-subscription.store';
import { validPushKeys } from './push-keys';

/** Тестовые подмены: транспорт web-push и состояние ключей. */
export const PUSH_SEND = 'PUSH_SEND';
export const PUSH_VAPID = 'PUSH_VAPID';

/** Итог отправки человеку во все его устройства (очередь уведомлений). */
export type PushOutcome = 'sent' | 'gone' | 'failed' | 'unknown';

/** Пробное уведомление сразу после включения: человек видит, что дошло. */
export const PUSH_ENABLED_PAYLOAD: PushPayload = {
  title: PUSH_TITLE,
  body: 'Готово: уведомления будут приходить сюда.',
  url: '/today',
  tag: 'push_enabled',
};

/** Свести исходы по устройствам в один (чистая функция). */
export function mergeOutcomes(results: PushAttempt[]): PushOutcome {
  if (results.includes('accepted')) return 'sent';
  if (results.every((r) => r === 'gone')) return 'gone';
  // Хоть одно устройство могло получить — повтор дал бы дубль.
  if (results.includes('unknown')) return 'unknown';
  return 'failed';
}

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly send: SendFn;
  private readonly vapid: VapidState;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly analytics?: AnalyticsService,
    @Optional() @Inject(PUSH_SEND) send?: SendFn,
    @Optional() @Inject(PUSH_VAPID) vapid?: VapidState,
  ) {
    this.send = send ?? sendNotification;
    this.vapid = vapid ?? vapidState();
    if (this.vapid.kind === 'broken') {
      this.logger.warn(
        `Уведомления в приложении выключены: ${this.vapid.problem}`,
      );
    }
  }

  /** Публичный ключ для подписки браузера; null — уведомления не настроены. */
  publicKey(): string | null {
    return this.vapid.kind === 'ready' ? this.vapid.config.publicKey : null;
  }

  /**
   * Сохранить подписку за человеком и сразу прислать в неё пробное
   * уведомление. delivered — принял ли его push-сервис.
   */
  async subscribe(
    userId: bigint,
    keys: PushKeys,
  ): Promise<{ delivered: boolean }> {
    if (this.vapid.kind !== 'ready') {
      throw new ServiceUnavailableException(
        'Уведомления в приложении не настроены',
      );
    }
    const verdict = checkPushEndpoint(keys.endpoint);
    if (!verdict.ok) {
      // Хост — не секрет, весь адрес — секрет: по логу расширяют список.
      this.logger.warn(
        `Подписка отклонена: хост ${verdict.host ?? '(адрес не разобран)'} не из списка push-сервисов`,
      );
      throw new BadRequestException('Адрес подписки не принят');
    }
    if (!validPushKeys(keys.p256dh, keys.auth)) {
      throw new BadRequestException('Ключи подписки не приняты');
    }
    const stored = await saveSubscription(this.prisma, userId, keys);
    const result = await this.deliverOne(
      userId,
      stored,
      JSON.stringify(PUSH_ENABLED_PAYLOAD),
    );
    const delivered = result === 'accepted';
    await this.analytics?.track(userId, 'push_subscribed', {
      delivered,
      service: verdict.service,
    });
    return { delivered };
  }

  /** Удалить подписку, только если она этого человека; иначе — молча. */
  async unsubscribe(
    userId: bigint,
    endpoint: string,
    reason: PushUnsubscribeReason = 'user',
  ): Promise<void> {
    if (await deleteOwnSubscription(this.prisma, userId, endpoint)) {
      await this.analytics?.track(userId, 'push_unsubscribed', { reason });
    }
  }

  /** У кого из пачки есть подписка — одним запросом. */
  subscribedUserIds(ids: bigint[]): Promise<Set<string>> {
    return subscribedUserIds(this.prisma, ids);
  }

  /** Отправить во все устройства человека (очередь уведомлений). */
  async sendToUser(userId: bigint, payload: PushPayload): Promise<PushOutcome> {
    if (this.vapid.kind !== 'ready') return 'failed';
    const subs = await subscriptionsOf(this.prisma, userId);
    if (subs.length === 0) return 'gone';
    const body = JSON.stringify(payload);
    const results = await Promise.all(
      subs.map((s) => this.deliverOne(userId, s, body)),
    );
    return mergeOutcomes(results);
  }

  private async deliverOne(
    userId: bigint,
    sub: StoredPush,
    body: string,
  ): Promise<PushAttempt> {
    if (this.vapid.kind !== 'ready') return 'failed';
    const verdict = checkPushEndpoint(sub.endpoint);
    if (!verdict.ok) {
      // Адрес не расшифровался (ключ шифрования) или хост выпал из списка —
      // не удаляем: при сбое ключа это стёрло бы подписки у всех.
      this.logger.warn(`Подписка id=${sub.id}: адрес не прошёл проверку`);
      return 'failed';
    }
    const { result, status } = await attemptPush(
      this.send,
      sub,
      body,
      this.vapid.config,
    );
    if (result === 'gone') {
      await deleteSubscription(this.prisma, sub.id);
      await this.analytics?.track(userId, 'push_gone', {
        service: pushServiceOf(sub.endpoint),
      });
    } else if (result !== 'accepted') {
      this.logger.warn(
        `Уведомление в приложение не принято: ${verdict.host} ` +
          `(${status === null ? result : `HTTP ${status}`})`,
      );
    }
    return result;
  }
}

import { Inject, Injectable, Logger } from '@nestjs/common';
import { HealthyAdultService } from '../bot/healthy-adult.service';
import {
  CHANNEL_TARGETS,
  type ChannelTarget,
  type PublishResult,
} from './channel-target';
import { makeChannelPost } from './pin-image';
import { checkResult, unknownPlatform } from './publish-report';
import { DeliveryLogService } from './delivery-log.service';
import { formatDeliveryLog } from './delivery-log.format';

/**
 * Проверка одной площадки — `/zv max` вместо `/zv`.
 *
 * Обычная публикация уходит сразу везде, поэтому проверить свежеподключённый
 * MAX значило бы разослать настоящий пост подписчикам Telegram, VK и Threads.
 * Здесь пост уходит только на названную площадку.
 *
 * Проверка намеренно НЕ трогает пул и НЕ пишет HealthyAdultPost: иначе каждый
 * тест жёг бы фразу и сдвигал «последний пост», а расписание сочло бы слот
 * закрытым и пропустило настоящую публикацию. Поэтому берётся текст, который
 * уже звучал; пустая история — единственный случай, когда фраза берётся из
 * пула (там ещё нечего сдвигать).
 */
@Injectable()
export class ChannelCheckService {
  private readonly logger = new Logger(ChannelCheckService.name);

  constructor(
    @Inject(CHANNEL_TARGETS) private readonly targets: ChannelTarget[],
    private readonly phrases: HealthyAdultService,
    private readonly deliveries: DeliveryLogService,
  ) {}

  /** Ключи площадок для подсказки, если имя не угадали. */
  private names(): string[] {
    return this.targets.map((t) => t.platform);
  }

  /** `/zv log` — последние отправки по всем площадкам, из журнала в БД. */
  async log(): Promise<string> {
    return formatDeliveryLog(await this.deliveries.recent());
  }

  async checkOne(platform: string): Promise<PublishResult> {
    const target = this.targets.find(
      (t) => t.platform === platform.trim().toLowerCase(),
    );
    if (!target) return unknownPlatform(platform, this.names());

    const destination = target.destination();
    if (!destination)
      return unknownPlatform(platform, this.names(), {
        title: target.title,
        envKey: target.envKey,
      });

    const [recent] = await this.phrases.recentPostTexts(1);
    const text = recent ?? (await this.phrases.pickFromPool([]));
    if (!text) return checkResult(target, destination, '', 'нечего отправить');

    const result = await this.trySend(target, destination, text);
    // Проверка тоже попадает в журнал: «я же проверял, доходило» — это вопрос
    // к данным, а не к памяти.
    await this.deliveries.record('проверка', result.delivered, result.failed);
    return result;
  }

  private async trySend(
    target: ChannelTarget,
    destination: string,
    text: string,
  ): Promise<PublishResult> {
    try {
      await target.send(makeChannelPost(text), destination);
      this.logger.log(`healthy_adult_check ${target.platform}=${destination}`);
      return checkResult(target, destination, text);
    } catch (err) {
      const reason = target.explain(err);
      this.logger.warn(`healthy-adult check ${target.platform}: ${reason}`);
      return checkResult(target, destination, text, reason);
    }
  }
}

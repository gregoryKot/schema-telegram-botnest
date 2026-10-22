// Темп и итог одного прогона очереди уведомлений. Вынесено из
// telegram.schedule-queue.ts (правило №10).
//
// Темп — PacedSender (пауза между отправками и ожидание по 429). Итог —
// числа прогона: в лог одной строкой, если прогон остановлен лимитом, и
// событием notify_queue_tick в отчёт /stats (блок «Напоминания из бота»,
// src/bot/notify-queue-metrics.*). Строки на каждое уведомление нет: авария —
// это поток, сотня строк равна замьюченному логу (урок 2026-07-29).
import type { Logger } from '@nestjs/common';
import { PacedSender, type PaceOptions } from './telegram.paced-sender';
import { QUEUE_TICK_BUDGET_MS } from './telegram.schedule-queue.budget';

// type, а не interface: значение уходит в meta события как
// Record<string, unknown>, а interface без индексной сигнатуры туда не встаёт.
export type QueueTickTally = {
  /** Доставлено. */
  sent: number;
  /** Временный сбой (наш или сети): строка осталась, повтор на следующем тике. */
  transient: number;
  /** Telegram ответил 429, подождали retry_after и повторили. */
  waited: number;
  /** Осталось на следующий тик: лимит Telegram или кончился бюджет прогона. */
  deferred: number;
};

type Stop = 'rate_limited' | 'out_of_time';

export function describeQueueStop(stop: Stop, tally: QueueTickTally): string {
  const why =
    stop === 'rate_limited'
      ? 'Telegram ответил 429 и просит ждать дольше, чем осталось прогону'
      : 'кончился бюджет прогона';
  return (
    `Очередь: ${why} — остановлена, отложено лимитом ${tally.deferred} ` +
    `уведомлений до следующего тика (ушло ${tally.sent}).`
  );
}

export class QueueTick {
  readonly tally: QueueTickTally = {
    sent: 0,
    transient: 0,
    waited: 0,
    deferred: 0,
  };
  private stop: Stop | null = null;
  private readonly pacer: PacedSender;

  constructor(pace?: PaceOptions) {
    this.pacer = new PacedSender({ budgetMs: QUEUE_TICK_BUDGET_MS, ...pace });
  }

  /**
   * false — дальше в этом прогоне не шлём: строка и `left - 1` следующих
   * остаются с sentAt=null, их подберёт следующий тик (тихие часы
   * проверятся заново). Ошибки, кроме 429, пробрасываются вызывающему.
   */
  async send(attempt: () => Promise<void>, left: number): Promise<boolean> {
    const result = await this.pacer.send(attempt);
    if (result === 'sent') {
      this.tally.sent++;
      return true;
    }
    this.stop = result;
    this.tally.deferred = left;
    return false;
  }

  async finish(
    logger: Logger,
    track?: (tally: QueueTickTally) => Promise<void> | undefined,
  ): Promise<void> {
    this.tally.waited = this.pacer.waited;
    if (this.stop) logger.warn(describeQueueStop(this.stop, this.tally));
    await track?.(this.tally);
  }
}

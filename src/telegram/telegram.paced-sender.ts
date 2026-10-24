// Темп отправки в Telegram для циклов «много сообщений подряд» (очередь
// уведомлений, /broadcast).
//
// Аудит 2026-10: очередь слала до 500 сообщений без паузы, а на ответ 429
// («слишком часто») не обращала внимания — следующая строка уходила сразу,
// и бот сам продлевал себе ограничение. Здесь два правила:
//   * между отправками пауза (по умолчанию 35 мс — до ~28 сообщений в
//     секунду при потолке Telegram около 30, https://core.telegram.org/bots/faq);
//   * на 429 ждём ровно `retry_after` и повторяем ОДИН раз — если ожидание
//     укладывается в бюджет прогона. Не укладывается, или второй ответ снова
//     429 — прогон останавливается, остальное уходит в следующий заход.
//
// Сама отправка — параметр (`attempt`), чаще всего sendBounded: отмена по
// таймауту и разбор «неизвестного исхода» (#681) живут там и здесь не
// смешиваются. Исход «неизвестно» сюда не попадает как 429 и не повторяется:
// повтор дал бы дубль.
import { isRateLimited, retryAfterMs } from './telegram-rate-limit';

export const SEND_PAUSE_MS = 35;

export interface PaceOptions {
  /** Пауза перед каждой отправкой, кроме первой. 0 — без паузы. */
  pauseMs?: number;
  /** Сколько всего может длиться прогон, считая ожидание по 429. */
  budgetMs?: number;
  /** Ожидание; в тестах подменяется, в проде — setTimeout. */
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

/**
 * sent — доставлено (в том числе со второй попытки после ожидания);
 * rate_limited — Telegram попросил подождать дольше, чем осталось бюджета,
 *   либо повтор снова получил 429: дальше в этом прогоне слать нельзя;
 * out_of_time — бюджет прогона исчерпан до отправки, запрос не уходил.
 */
export type PacedResult = 'sent' | 'rate_limited' | 'out_of_time';

// setTimeout, а не timers/promises: фейковые таймеры jest двигают только его.
const realSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export class PacedSender {
  /** Сколько раз Telegram попросил подождать, мы подождали и повторили. */
  waited = 0;
  private calls = 0;
  private readonly startedAt: number;
  private readonly pauseMs: number;
  private readonly budgetMs: number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => number;

  constructor(opts: PaceOptions = {}) {
    this.pauseMs = opts.pauseMs ?? SEND_PAUSE_MS;
    this.budgetMs = opts.budgetMs ?? Number.POSITIVE_INFINITY;
    this.sleep = opts.sleep ?? realSleep;
    this.now = opts.now ?? Date.now;
    this.startedAt = this.now();
  }

  private elapsed(): number {
    return this.now() - this.startedAt;
  }

  /** Ошибки, кроме 429, пробрасываются как есть — их разбирает вызывающий. */
  async send(attempt: () => Promise<void>): Promise<PacedResult> {
    if (this.calls > 0 && this.pauseMs > 0) await this.sleep(this.pauseMs);
    if (this.elapsed() >= this.budgetMs) return 'out_of_time';
    this.calls++;
    try {
      await attempt();
      return 'sent';
    } catch (err: unknown) {
      if (!isRateLimited(err)) throw err;
      const wait = retryAfterMs(err);
      if (wait === null || this.elapsed() + wait >= this.budgetMs) {
        return 'rate_limited';
      }
      this.waited++;
      await this.sleep(wait);
      try {
        await attempt();
        return 'sent';
      } catch (again: unknown) {
        if (isRateLimited(again)) return 'rate_limited';
        throw again;
      }
    }
  }
}

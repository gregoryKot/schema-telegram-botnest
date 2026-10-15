// Запуск long-polling с ретраем и наблюдаемым состоянием.
//
// Корень (аудит 2026-10, backend#12): `bot.launch()` резолвится лишь когда
// поллинг остановлен, а реджектится на ЛЮБОМ сбое getUpdates — и Telegraf на
// 409 («terminated by other getUpdates request») не ретраит, а завершает цикл
// навсегда. Раньше 409 глотался голым `return`: бот молчал до следующего
// деплоя при зелёных getMe и /health. 409 бывает и транзиентом (старый
// контейнер ещё держит long-poll, деплой идёт несколько раз в день), и
// настоящей бедой (второй экземпляр с тем же токеном) — оба требуют ретрая и
// сигнала, а не тишины.
//
// Ретраим бесконечно: «сдаться» = мёртвый поллинг до деплоя, тот же класс.
// Шум ограничен: warn на каждую попытку, error (уходит владельцу через
// AlertLogger) — на 5-й подряд и дальше раз в ERROR_REPEAT_EVERY попыток.
import type { Logger } from '@nestjs/common';
import type { Context, Telegraf } from 'telegraf';
import { pollingStatus } from '../infra/self-check/polling-status';

/** Паузы перед 1-й, 2-й, 3-й попытками; дальше — раз в минуту. */
export const RETRY_DELAYS_MS = [5_000, 15_000, 60_000];
/** С какой подряд неудачи warn превращается в error (→ DM владельцу). */
export const ERROR_AFTER_FAILURES = 5;
/** Дальше error повторяется раз в столько неудач (≈ раз в 15 минут). */
export const ERROR_REPEAT_EVERY = 15;

export function retryDelayMs(
  failures: number,
  delays: readonly number[] = RETRY_DELAYS_MS,
): number {
  return delays[Math.min(failures, delays.length) - 1];
}

/** Нужно ли на этой по счёту подряд неудаче поднять error. */
export function shouldAlert(failures: number): boolean {
  return (
    failures === ERROR_AFTER_FAILURES ||
    (failures > ERROR_AFTER_FAILURES &&
      (failures - ERROR_AFTER_FAILURES) % ERROR_REPEAT_EVERY === 0)
  );
}

export function isPollingConflict(err: unknown): boolean {
  if ((err as { code?: number })?.code === 409) return true;
  const msg = String(err);
  return msg.includes('409') || msg.includes('terminated by other');
}

/** getUpdates основного цикла поллинга (а не служебный sync offset). */
function isLongPoll(args: readonly unknown[]): boolean {
  if (args[0] !== 'getUpdates') return false;
  const timeout = (args[1] as { timeout?: unknown } | undefined)?.timeout;
  return typeof timeout === 'number' && timeout > 0;
}

export class BotLauncher {
  private failures = 0;
  private stopped = false;
  private timer: NodeJS.Timeout | undefined;

  constructor(
    private readonly bot: Telegraf<Context>,
    private readonly logger: Logger,
    /** Паузы между попытками; тесты передают короткие. */
    private readonly delays: readonly number[] = RETRY_DELAYS_MS,
  ) {}

  start(): void {
    this.logger.log('Bot launch initiated');
    pollingStatus.set('starting');
    this.watchGetUpdates();
    this.attempt();
  }

  /**
   * Цикл, который уже идёт, рвёт владелец (`bot.stop()`); цикл, который
   * поднимет попытка в полёте, гасит watchGetUpdates — см. там.
   */
  stop(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    pollingStatus.set('stopped');
  }

  /**
   * `running` — только после ОТВЕТА getUpdates: getMe отвечает и у мёртвого
   * поллинга (на нём стоит telegramProbe), а 409 прилетает именно на getUpdates.
   * Telegraf не отдаёт этот факт наружу, поэтому наблюдаем вызов API.
   *
   * Считаем только long-poll основного цикла (`timeout` > 0). После любого
   * не-409 сбоя Telegraf в `finally` зовёт служебный getUpdates {offset,
   * limit: 1} без `timeout` (syncUpdateOffset): он проходит и у падающего
   * цикла, и если засчитывать его, счётчик подряд идущих неудач обнуляется
   * перед каждым onFailure — до error (DM владельцу) дело не доходит.
   *
   * Long-poll после stop() обрывается до сети. Попытка, начатая до stop()
   * (getMe/deleteWebhook в полёте), доходит до поллинга уже после него: тогда
   * `bot.stop()` владельца гасил прежний, уже мёртвый цикл, а новый жил
   * вечно — на сетевой ошибке Telegraf ретраит getUpdates раз в 5 с без
   * конца. Так ночной jest не выходил после всех тестов (ci-alarm #672).
   */
  private watchGetUpdates(): void {
    const tg = this.bot.telegram as unknown as
      { callApi?: (...args: unknown[]) => Promise<unknown> } | undefined;
    const original = tg?.callApi;
    if (!tg || !original) return;
    tg.callApi = async (...args: unknown[]) => {
      // Long-poll зовёт уже созданный цикл, поэтому bot.stop() рвёт именно
      // его; запрос с оборванным сигналом в сеть не уходит (AbortError).
      if (this.stopped && isLongPoll(args)) this.bot.stop('BotLauncher.stop');
      const result: unknown = await original.call(tg, ...args);
      if (isLongPoll(args) && !this.stopped) {
        this.failures = 0;
        pollingStatus.set('running');
      }
      return result;
    };
  }

  private attempt(): void {
    let launched: Promise<void>;
    try {
      // dropPendingUpdates: false — намеренно. true стирает на стороне
      // Telegram всё, что люди написали боту за окно деплоя (стоп старого
      // контейнера → старт нового), а деплоев несколько в день (backend#16).
      // Хвост после долгого простоя режет telegram.stale-updates.ts.
      launched = this.bot.launch({ dropPendingUpdates: false });
    } catch (err) {
      this.onFailure(err);
      return;
    }
    launched.then(
      () => {
        // Резолв без stop() — поллинг закончился сам. Telegraf так не делает,
        // но если сделает, тишина недопустима: проба покраснеет через 2 минуты.
        if (this.stopped) return;
        this.logger.warn('Bot polling завершился без ошибки и без остановки');
        pollingStatus.set('failed', 'поллинг завершился сам');
      },
      (err: unknown) => this.onFailure(err),
    );
  }

  private onFailure(err: unknown): void {
    if (this.stopped) return;
    this.failures += 1;
    const delayMs = retryDelayMs(this.failures, this.delays);
    const reason = isPollingConflict(err)
      ? '409: getUpdates ведёт другой экземпляр бота (или Telegram ещё держит ' +
        'запрос старого контейнера)'
      : String(err);
    pollingStatus.set('failed', reason.slice(0, 200));
    const text =
      `Bot polling не работает (подряд неудач: ${this.failures}), ` +
      `ретрай через ${delayMs / 1000} с: ${reason}`;
    if (shouldAlert(this.failures)) this.logger.error(text, err);
    else this.logger.warn(text);
    this.timer = setTimeout(() => this.attempt(), delayMs);
    this.timer.unref();
  }
}

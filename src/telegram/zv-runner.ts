// Ручная публикация канала (/zv) фоном. По образцу BroadcastRunner.
//
// E16 (аудит 2026-11): /zv ждал публикацию прямо в обработчике. Рассылка по
// всем площадкам длится до минуты и дольше (Threads, сетевые таймауты,
// ожидание по 429), а Telegraf обрабатывает пачку апдейтов целиком и не
// берёт следующую, пока не ответит вся пачка: бот замирал для всех, а через
// 90 с (`handlerTimeout`) обработчик обрывался. Теперь обработчик только
// запускает публикацию, итог приходит отдельным сообщением.

export interface ZvOutcome {
  message: string;
}

interface ZvLogger {
  error(message: string, err?: unknown): void;
  warn(message: string, err?: unknown): void;
}

export const ZV_STARTED = '⏳ Публикую — итог придёт отдельным сообщением.';
export const ZV_BUSY =
  '⏳ Публикация уже идёт — итог придёт отдельным сообщением.';

export class ZvRunner {
  /** Идущая публикация (null — свободно). Вторая параллельная не стартует:
   * двойной /zv дал бы два одинаковых поста в канале. */
  current: Promise<void> | null = null;

  /** false — прошлая публикация ещё идёт, новая не запущена. */
  start(
    job: () => Promise<ZvOutcome>,
    reply: (text: string) => Promise<unknown>,
    logger: ZvLogger,
  ): boolean {
    if (this.current) return false;
    // Сбой подтверждения не отменяет публикацию: о ней скажет итог.
    this.current = reply(ZV_STARTED)
      .catch(() => undefined)
      .then(job)
      .then((res) => reply(res.message))
      .catch((err: unknown) => {
        logger.error('zv command failed', err);
        return reply(`❌ ${String(err).slice(0, 300)}`);
      })
      // и отчёт о сбое не ушёл (Telegram недоступен) — в лог, флаг снимается
      .catch((err: unknown) => logger.warn('zv: итог админу не ушёл', err))
      .then(() => {
        this.current = null;
      });
    return true;
  }
}

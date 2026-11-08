// Ручная публикация канала (/zv) фоном. По образцу BroadcastRunner.
//
// E16 (аудит 2026-11): /zv ждал публикацию прямо в обработчике. Рассылка по
// всем площадкам длится до минуты и дольше (Threads, сетевые таймауты,
// ожидание по 429), а Telegraf обрабатывает пачку апдейтов целиком и не
// берёт следующую, пока не ответит вся пачка: бот замирал для всех, а через
// 90 с (`handlerTimeout`) обработчик обрывался. Теперь обработчик только
// запускает публикацию, итог приходит отдельным сообщением.
//
// Хвост R7 (аудит 2026-11): /zv и тик расписания друг о друге не знали —
// ручная публикация во время тика давала в канале два поста. Флаг «в полёте»
// теперь общий (ChannelPublisherService.inFlight): занят расписанием — /zv
// не стартует и говорит админу почему; занят /zv — тик пропускается.
import type { OneAtATime } from '../channel/one-at-a-time';

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
const ZV_HOLDER = '/zv';

/** Флаг держит не /zv: называем, кто, и почему не стартуем. */
export const zvBusyWith = (holder: string) =>
  `⏳ Сейчас выходит ${holder} — /zv не запущен, иначе в канале будет два поста. ` +
  'Что вышло — /zv log, повторить можно через пару минут.';

export class ZvRunner {
  /** Идущая публикация /zv (null — нет). Вторую не пускает флаг `gate`:
   * двойной /zv дал бы два одинаковых поста в канале. */
  current: Promise<void> | null = null;

  /** null — публикация запущена; иначе — текст отказа для админа. */
  start(
    job: () => Promise<ZvOutcome>,
    reply: (text: string) => Promise<unknown>,
    logger: ZvLogger,
    gate: OneAtATime,
  ): string | null {
    const release = gate.claim(ZV_HOLDER);
    if (!release) {
      const holder = gate.holder;
      return !holder || holder === ZV_HOLDER ? ZV_BUSY : zvBusyWith(holder);
    }
    // Сбой подтверждения не отменяет публикацию: о ней скажет итог.
    const run: Promise<void> = reply(ZV_STARTED)
      .catch(() => undefined)
      .then(job)
      // Публикация кончилась — флаг свободен: зависший ответ админу не держит тик.
      .finally(release)
      .then((res) => reply(res.message))
      .catch((err: unknown) => {
        logger.error('zv command failed', err);
        return reply(`❌ ${String(err).slice(0, 300)}`);
      })
      // и отчёт о сбое не ушёл (Telegram недоступен) — в лог, флаг снимается
      .catch((err: unknown) => logger.warn('zv: итог админу не ушёл', err))
      .then(() => {
        if (this.current === run) this.current = null;
      });
    this.current = run;
    return null;
  }
}

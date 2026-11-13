// Запуск /broadcast фоном. Вынесено из telegram.broadcast.ts (храповик
// размера, правило №10); цикл рассылки — там.
import {
  describeBroadcastResult,
  runBroadcast,
  type BroadcastDeps,
} from './telegram.broadcast';

/**
 * Рассылка фоном, по одной за раз. Обработчик команды Telegraf обрывается
 * через 90 с (`handlerTimeout`): при паузе 50 мс это ~1800 адресатов, а
 * ожидание по 429 делает рассылку ещё дольше. Поэтому обработчик только
 * запускает её, а итог приходит отдельным сообщением.
 */
export class BroadcastRunner {
  /** Идущая рассылка (null — свободно); вторая параллельная не стартует. */
  current: Promise<void> | null = null;

  /** false — предыдущая рассылка ещё идёт, новая не запущена. */
  start(
    deps: BroadcastDeps,
    userIds: bigint[],
    chatIds: Map<string, bigint>,
    text: string,
    reply: (msg: string) => Promise<unknown>,
  ): boolean {
    if (this.current) return false;
    this.current = reply(
      `Начинаю рассылку для ${userIds.length} пользователей…`,
    )
      .then(() => runBroadcast(deps, userIds, chatIds, text))
      .then((r) => reply(describeBroadcastResult(r)))
      .catch((err: unknown) => {
        deps.logger.error('broadcast failed', err);
        return reply('❌ Ошибка рассылки');
      })
      // и отчёт о сбое не ушёл (Telegram недоступен) — в лог, рассылка не висит
      .catch((err: unknown) =>
        deps.logger.warn('broadcast: отчёт админу не ушёл', err),
      )
      .then(() => {
        this.current = null;
      });
    return true;
  }
}

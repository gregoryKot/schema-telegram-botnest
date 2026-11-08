import { Logger } from '@nestjs/common';
import { Context, Telegraf } from 'telegraf';
import { BOT_COMMANDS, CABINET_URL } from './telegram.constants';
import { retryWithBackoff } from '../utils/retry';

/**
 * Декоративные вызовы Telegram API на старте: меню команд и кнопка кабинета.
 * На свежем контейнере сеть может подняться позже процесса — ретраим с
 * бэкоффом и НЕ будим админа error-алертом: бот полноценно работает и без
 * них (инцидент 2026-07-12: «🚨 setMyCommands failed» на деплое).
 * Fire-and-forget — launch() не ждёт.
 *
 * `signal` (TelegramService.onModuleDestroy) обрывает ожидание между
 * попытками: иначе таймер бэкоффа держал процесс после app.close() — e2e не
 * выходили сразу после тестов (2026-11-08), а на проде остановка посреди
 * ретраев ждала бы его до 15 с. Оборванные ретраи — не сбой, warn молчит.
 */
export function setupBotMenu(
  bot: Telegraf<Context>,
  logger: Logger,
  signal: AbortSignal,
): void {
  const decorate = (what: string, call: () => Promise<unknown>) =>
    void retryWithBackoff(call, { signal }).then((ok) => {
      if (!ok && !signal.aborted) logger.warn(`${what} failed after retries`);
    });
  decorate('setMyCommands', () => bot.telegram.setMyCommands(BOT_COMMANDS));
  decorate('setChatMenuButton', () =>
    bot.telegram.callApi('setChatMenuButton', {
      menu_button: {
        type: 'web_app',
        text: 'Всё по схеме',
        web_app: { url: CABINET_URL },
      },
    }),
  );
}

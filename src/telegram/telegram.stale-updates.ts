// Защита от «хвоста» очереди апдейтов (аудит 2026-10, backend#16).
//
// launch() больше не стирает очередь (dropPendingUpdates: false), поэтому после
// деплоя бот получает всё, что люди написали за окно. Три следствия, три
// предохранителя — все как middleware, до любых хендлеров:
//
// 1. Сообщению старше 10 минут отвечать поздно: человек давно ушёл, а ответ
//    «через сутки» читается как сбой. Возраст — по `message.date` (момент
//    отправки). У callback_query своей даты нет: `callback_query.message.date`
//    — это дата сообщения С КНОПКОЙ, а не нажатия, и по ней отбрасывалась бы
//    каждая кнопка под вчерашним сообщением. Поэтому кнопки возрастом не
//    режем.
// 2. Нажатие из очереди Telegram может отказаться подтверждать («query is too
//    old»): хендлеры зовут answerCbQuery первым делом, и без этого ошибка
//    срывала бы само действие. Подтверждение просроченного нажатия глотаем —
//    действие выполняется, спиннер у человека уже погас.
// 3. После 409 Telegraf не подтвердил последнюю пачку и отдаст её повторно
//    при перезапуске поллинга — одинаковый update_id не обрабатываем дважды.
import { Logger } from '@nestjs/common';
import type { Context, Middleware, Telegraf } from 'telegraf';
import { installPrivateChatOnly } from './private-chat-only';

export const STALE_MESSAGE_MS = 10 * 60_000;
export const SEEN_UPDATES_LIMIT = 200;

/** «query is too old…» / «query ID is invalid» — нажатие уже не подтвердить. */
export function isExpiredCallbackQuery(err: unknown): boolean {
  const description = (err as { description?: string })?.description;
  return /query is too old|query ID is invalid/i.test(
    description ?? String(err),
  );
}

type AnswerFn = (text?: string, extra?: object) => Promise<true>;

/** Узкий срез Context, который трогает guard (и который виден линтеру). */
interface GuardContext {
  update: { update_id: number };
  message?: { date: number };
  callbackQuery?: unknown;
  answerCbQuery: AnswerFn;
}

export function staleUpdateGuard(
  now: () => number = Date.now,
  logger: Pick<Logger, 'log'> = new Logger('StaleUpdates'),
): Middleware<Context> {
  const seen = new Set<number>();
  return async (ctx: GuardContext, next: () => Promise<void>) => {
    const id = ctx.update.update_id;
    if (typeof id === 'number') {
      if (seen.has(id)) return;
      seen.add(id);
      if (seen.size > SEEN_UPDATES_LIMIT) {
        seen.delete(seen.values().next().value as number);
      }
    }

    const sentSec = ctx.message?.date;
    if (sentSec !== undefined && now() - sentSec * 1000 > STALE_MESSAGE_MS) {
      logger.log(`Отброшено устаревшее сообщение (update ${id})`);
      return;
    }

    if (ctx.callbackQuery) {
      const original = ctx.answerCbQuery.bind(ctx) as AnswerFn;
      const tolerant: AnswerFn = async (text, extra) => {
        try {
          return await original(text, extra);
        } catch (err) {
          // Тип Telegraf — Promise<true>; хендлеры значение не читают.
          if (isExpiredCallbackQuery(err)) return true;
          throw err;
        }
      };
      ctx.answerCbQuery = tolerant;
    }
    return next();
  };
}

/**
 * Предохранители входящего потока — ДО любых хендлеров: сначала группы и
 * каналы не обслуживаем вовсе, затем режем хвост очереди после деплоя.
 */
export function installUpdateGuards(bot: Telegraf<Context>): void {
  installPrivateChatOnly(bot);
  bot.use(staleUpdateGuard());
}

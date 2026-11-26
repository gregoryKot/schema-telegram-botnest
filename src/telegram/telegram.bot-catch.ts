// Последний рубеж для ошибок апдейта, вылетевших мимо try/catch хендлера.
//
// Без своего `bot.catch` ошибку получает обработчик Telegraf по умолчанию
// (node_modules/telegraf/lib/telegraf.js, handleError): он ставит
// `process.exitCode = 1` и пробрасывает ошибку дальше — цикл поллинга рвётся,
// BotLauncher поднимает его через 5 с с warn, а апдейт с ошибкой не
// повторяется (offset Telegraf уже сдвинул). Одна кривая кнопка на секунды
// глушила бота для всех.
//
// Здесь ошибка уходит в `logger.error` — Nest-логгер приложения (AlertLogger)
// доставляет его владельцу со своим троттлингом по ключу и общим бюджетом, —
// и дальше не летит: поллинг идёт, остальные апдейты пачки обрабатываются.
// В текст попадает тип апдейта и update_id, но не текст сообщения человека.
import { Logger } from '@nestjs/common';
import type { Context, Telegraf } from 'telegraf';
import { installUpdateGuards } from './telegram.stale-updates';

const defaultLogger = new Logger('TelegrafCatch');

/** Тип апдейта — первый ключ кроме update_id. Не `ctx.updateType`: тот
 * бросает на апдейте неизвестной формы, а здесь бросать уже некуда. */
function describeUpdate(ctx: Context | undefined): string {
  const update = ctx?.update;
  const keys = update ? Object.keys(update) : [];
  const type = keys.find((k) => k !== 'update_id') ?? 'unknown';
  return update ? `${type} (update_id ${update.update_id})` : type;
}

/** Предохранители апдейтов (telegram.stale-updates.ts) и свой bot.catch —
 * одним вызовом фабрики бота, до любых хендлеров. */
export function installUpdateSafety(bot: Telegraf<Context>): void {
  installUpdateGuards(bot);
  installBotCatch(bot);
}

export function installBotCatch(
  bot: Telegraf<Context>,
  logger: Pick<Logger, 'error'> = defaultLogger,
): void {
  bot.catch((err: unknown, ctx: Context) => {
    const reason = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    logger.error(
      `Telegraf: необработанная ошибка апдейта ${describeUpdate(ctx)}: ${reason}`,
      stack,
    );
  });
}

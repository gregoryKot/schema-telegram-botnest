import type { Logger } from '@nestjs/common';
import type { Context, Telegraf } from 'telegraf';
import { isAdminSender } from '../utils/admin-alert';

/** Разовая админ-команда: `/<name>` — сухой прогон, `/<name> go` — боевой. */
export interface BackgroundAdminCommand {
  name: string;
  /** Ответ на повторный вызов, пока идёт прогон. */
  busy: string;
  /** Ответ, если прогон оборвался исключением. */
  failed: string;
  run(live: boolean): Promise<string>;
}

/**
 * Только ADMIN_ID, один прогон за раз, итог — отдельным сообщением: проход по
 * площадке с паузами дольше таймаута обработчика бота.
 */
export function registerBackgroundAdminCommand(
  bot: Telegraf<Context> | null,
  logger: Logger,
  cmd: BackgroundAdminCommand,
): void {
  let running: Promise<void> | null = null;
  bot?.command(cmd.name, async (ctx) => {
    try {
      if (!isAdminSender(ctx.from)) {
        await ctx.reply('⛔ Нет доступа');
        return;
      }
      if (running) {
        await ctx.reply(cmd.busy);
        return;
      }
      const live = ctx.message.text.split(/\s+/)[1] === 'go';
      await ctx.reply('⏳ Запущено — итог придёт отдельным сообщением.');
      running = cmd
        .run(live)
        .then((text) => ctx.reply(text))
        .then(() => undefined)
        .catch(async (err: unknown) => {
          logger.error(`${cmd.name} failed`, err);
          await ctx.reply(cmd.failed).catch(() => null);
        })
        .finally(() => {
          running = null;
        });
    } catch (err) {
      logger.error(`${cmd.name} command failed`, err);
    }
  });
}

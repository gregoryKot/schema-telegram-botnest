// /stats: главные цифры + кнопки-разделы; /stats all — старый полный отчёт.
// Вынесено из TelegramAdminService (№10). Только админ (ADMIN_ID).
import type { Context, Telegraf } from 'telegraf';
import { isAdminSender } from '../utils/admin-alert';
import { replyLong, splitForTelegram } from './send-long-text';
import { collectStatsMessages } from './stats-messages';
import {
  collectMainStats,
  collectStatsSection,
  type StatsDeps,
} from './stats-screens';
import {
  findStatsSection,
  STATS_ALL_ID,
  STATS_MAIN_ID,
  statsKeyboard,
  type StatsKeyboard,
} from '../bot/stats-sections';

const NO_ACCESS = '⛔ Нет доступа';
const NOT_MODIFIED_RE = /message is not modified/i;

interface StatsLogger {
  warn(msg: string): void;
  error(msg: string, err?: unknown): void;
}

/** Кусками под лимит Telegram; клавиатура — на последнем. `edit`: первый
 * кусок редактирует сообщение с кнопкой, остальные уходят новыми. */
async function showText(
  ctx: Context,
  text: string,
  keyboard: StatsKeyboard,
  edit: boolean,
): Promise<void> {
  const chunks = splitForTelegram(text);
  for (const [i, chunk] of chunks.entries()) {
    const extra = {
      parse_mode: 'HTML' as const,
      ...(i === chunks.length - 1 ? { reply_markup: keyboard } : {}),
    };
    if (edit && i === 0) {
      await ctx.editMessageText(chunk, extra).catch((err: unknown) => {
        // Повторный тап по тому же разделу — не ошибка.
        if (!NOT_MODIFIED_RE.test(String(err))) throw err;
        return null;
      });
    } else {
      await ctx.reply(chunk, extra);
    }
  }
}

export function registerStatsHandlers(
  bot: Telegraf<Context>,
  deps: StatsDeps,
  logger: StatsLogger,
): void {
  bot.command('stats', async (ctx) => {
    try {
      if (!isAdminSender(ctx.from)) {
        await ctx.reply(NO_ACCESS);
        return;
      }
      if (ctx.message?.text?.split(/\s+/)[1] === STATS_ALL_ID) {
        await sendFullReport(ctx, deps, logger);
        return;
      }
      const main = await collectMainStats(deps, logger);
      await showText(ctx, main, statsKeyboard(), false);
    } catch (err) {
      await failStats(ctx, 'stats command failed', err, logger);
    }
  });

  bot.action(/^stats:([a-z]+)$/, async (ctx) => {
    try {
      const id = ctx.match[1];
      // Отказы отвечают сами (Telegram принимает один ответ на нажатие);
      // к БД на этих ветках мы ещё не обращались.
      if (!isAdminSender(ctx.from)) {
        await ctx.answerCbQuery(NO_ACCESS);
        return;
      }
      const known =
        id === STATS_MAIN_ID || id === STATS_ALL_ID || !!findStatsSection(id);
      if (!known) {
        await ctx.answerCbQuery('Нет такого раздела');
        return;
      }
      await ctx.answerCbQuery();
      if (id === STATS_ALL_ID) {
        await sendFullReport(ctx, deps, logger);
      } else if (id === STATS_MAIN_ID) {
        const main = await collectMainStats(deps, logger);
        await showText(ctx, main, statsKeyboard(), true);
      } else {
        const text = await collectStatsSection(id, deps, logger);
        await showText(ctx, text, statsKeyboard(id), true);
      }
    } catch (err) {
      await failStats(ctx, 'stats action failed', err, logger);
    }
  });
}

async function sendFullReport(
  ctx: Context,
  deps: StatsDeps,
  logger: StatsLogger,
): Promise<void> {
  // Двумя сообщениями: отчёт длиннее лимита Telegram, replyLong режет по границам блоков.
  const { first, second } = await collectStatsMessages(deps, logger);
  await replyLong(ctx, first, { parse_mode: 'HTML' });
  await replyLong(ctx, second, { parse_mode: 'HTML' });
}

async function failStats(
  ctx: Context,
  what: string,
  err: unknown,
  logger: StatsLogger,
): Promise<void> {
  logger.error(what, err);
  await ctx.reply(`❌ ${String(err).slice(0, 300)}`).catch(() => null);
}

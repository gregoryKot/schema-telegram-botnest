// Бот отвечает только в личной переписке.
//
// Зачем. Карточки сверки входа и привязки (`/start login_<КОД>`, `link_<КОД>`)
// уходят в тот чат, где их запросили. В группе её видит и нажимает любой
// участник — и отдаёт СВОЮ сессию браузеру того, кто начал вход (при `link_` —
// сливает чужую личность со своим аккаунтом). Аудит 2026-10, B1.
//
// Глобальное правило вместо проверки в каждом хендлере: хендлеров много, а
// забытая проверка в новом — это снова дыра. Посты бота в каналы это не
// затрагивает: канал только ПОЛУЧАЕТ от нас сообщения, а входящих хендлеров на
// группы/каналы в боте нет (my_chat_member, channel_post не используются).
import type { Context, Middleware, Telegraf } from 'telegraf';

export const privateChatOnly: Middleware<Context> = async (ctx, next) => {
  const type = ctx.chat?.type;
  // chat нет (inline-режим, pre_checkout и т.п.) — не групповой апдейт.
  if (!type || type === 'private') return next();
  // Спиннер на кнопке гасим, иначе в группе он крутится вечно.
  if (ctx.callbackQuery) await ctx.answerCbQuery().catch(() => null);
};

/** Регистрировать ДО всех хендлеров: middleware telegraf идут по порядку. */
export function installPrivateChatOnly(bot: Telegraf<Context>): void {
  bot.use(privateChatOnly);
}

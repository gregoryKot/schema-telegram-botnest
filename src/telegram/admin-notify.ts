// DM владельцу практики от бота (TelegramService.notifyAdmin). Канал — бот и
// Telegram id владельца (ADMIN_ID, practice-owner.ts): без любого из двух
// отправка отвечает false без попытки, как на сбой Telegram. Кому разница
// важна (повтор доставки заявки), спрашивает adminChat до отправки.
import type { Logger } from '@nestjs/common';
import type { Context, Telegraf } from 'telegraf';
import { practiceOwnerTelegramId } from '../utils/practice-owner';
import { sendOnce } from './telegram.send-once';

type Bot = Telegraf<Context>;

/** Куда слать владельцу; null — канал не настроен (нет бота или ADMIN_ID). */
export function adminChat(
  bot: Bot | null,
): { bot: Bot; chatId: number } | null {
  const chatId = practiceOwnerTelegramId();
  return bot && chatId !== null ? { bot, chatId } : null;
}

/** Сообщение владельцу; true — доставлено. 429 — ожидание и повтор (send-once). */
export async function sendAdminDm(
  bot: Bot | null,
  text: string,
  logger: Pick<Logger, 'error'>,
): Promise<boolean> {
  const chat = adminChat(bot);
  if (!chat) return false;
  try {
    const opts = { parse_mode: 'HTML' } as const;
    await sendOnce(() =>
      chat.bot.telegram.sendMessage(chat.chatId, text, opts),
    );
    return true;
  } catch (err) {
    logger.error('notifyAdmin failed', err);
    return false;
  }
}

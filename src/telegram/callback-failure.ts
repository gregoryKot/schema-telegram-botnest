// Исход сбоя в хендлере кнопки (аудит 2026-10, «Долг с механизмом»).
//
// Хендлер кнопки обязан ответить на нажатие ДО обращения к БД
// (telegram.invariants.spec.ts), поэтому к моменту сбоя answerCbQuery уже
// отработал: спиннер погас, а второй ответ на то же нажатие Telegram
// отклоняет («query is too old … or query ID is invalid»), и эту ошибку
// молча глотает staleUpdateGuard. Человек не видел ничего и считал, что
// настройка сохранилась. Сообщаем об исходе сообщением в чат.
//
// Хелперы answerCbQuery НЕ зовут — и не должны: иначе повтор спрятался бы
// от инварианта «answerCbQuery в try ⇒ в catch его нет» (он пинит и этот файл).
import type { Logger } from '@nestjs/common';
import { Markup } from 'telegraf';
import type { Context } from 'telegraf';
import { ERROR_RETRY } from './telegram.constants';

/**
 * «message is not modified» — экран уже показывает то, что мы хотели
 * нарисовать (двойной тап). Это успех, а не сбой.
 */
export function isMessageNotModified(err: unknown): boolean {
  const description = (err as { description?: string })?.description;
  return /message is not modified/i.test(description ?? String(err));
}

type Log = Pick<Logger, 'log' | 'error'>;

/** true — сбой настоящий; ложь для «не изменено» (залогировано уровнем log). */
function report(logger: Log, what: string, err: unknown): boolean {
  if (isMessageNotModified(err)) {
    logger.log(`${what}: экран уже актуален (message is not modified)`);
    return false;
  }
  logger.error(`${what} failed`, err);
  return true;
}

/**
 * Сбой под напоминанием, карточкой выбора «ты/вы» или карточкой заявки:
 * новое сообщение, а не правка — кнопки исходного остаются, можно нажать ещё.
 */
export async function failCallback(
  logger: Log,
  ctx: Context,
  what: string,
  err: unknown,
): Promise<void> {
  if (!report(logger, what, err)) return;
  await ctx.reply(ERROR_RETRY).catch(() => null);
}

/**
 * Сбой на экране /settings: сообщение превращается в ошибку с кнопкой
 * «К настройкам», а не в повтор того же нажатия — toggle инвертирует
 * текущее значение, и повтор после частичного успеха вернул бы его назад.
 */
export async function failSettings(
  logger: Log,
  ctx: Context,
  what: string,
  err: unknown,
): Promise<void> {
  if (!report(logger, what, err)) return;
  const kb = Markup.inlineKeyboard([
    [Markup.button.callback('⬅️ К настройкам', 'settings:back')],
  ]);
  await ctx
    .editMessageText(ERROR_RETRY, kb)
    .catch(() => ctx.reply(ERROR_RETRY).catch(() => null));
}

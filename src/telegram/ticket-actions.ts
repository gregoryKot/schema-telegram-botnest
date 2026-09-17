// Общая обвязка кнопок на карточках сверки — их две (вход и объединение
// аккаунтов), и обе устроены одинаково: сначала гасим спиннер на кнопке,
// потом узнаём, ЧЕЙ это аккаунт, и только потом делаем дело. Две копии
// разъехались бы на первой правке (правило «одна механика — один компонент»).
import { Context } from 'telegraf';
import { Logger } from '@nestjs/common';
import { LoginTicketService } from '../auth/login-ticket/login-ticket.service';
import { SecurityLogService } from '../auth/security-log.service';
import { AccountService } from '../bot/account.service';

export interface DenyDeps {
  tickets: LoginTicketService;
  securityLog: SecurityLogService;
  logger: Logger;
}

/**
 * `reason` попадает в аудит и различает, ЧТО именно отклонили: вход или
 * объединение аккаунтов. `text` безличный — сюда мы попадаем в том числе
 * когда форму обращения прочитать не удалось.
 */
export async function handleTicketDeny(
  deps: DenyDeps,
  ctx: Context,
  code: string,
  reason: string,
  text: string,
): Promise<void> {
  try {
    await deps.tickets.deny(code);
    deps.securityLog.log('login_ticket_denied', {
      telegramId: ctx.from?.id,
      reason,
    });
    await ctx.editMessageText(text).catch(() => null);
  } catch (err) {
    // Сказать «отклонено», когда билет не погашен, хуже, чем показать сбой:
    // человек решит, что защитился, а код останется годным.
    deps.logger.error(
      `ticket deny (${reason}) failed: ${(err as Error).message}`,
      (err as Error).stack,
    );
  }
}

export interface ConfirmDeps {
  accountService: AccountService;
  logger: Logger;
}

/**
 * Преамбула кнопки «это я» на обеих карточках — всё, что идёт ПОСЛЕ
 * `answerCbQuery`. Сам `answerCbQuery` намеренно остаётся в теле хендлера:
 * его положение проверяет статический гейт (telegram.invariants.spec.ts), и
 * спрятать вызов сюда значило бы ослепить гейт ровно там, где он нужен.
 *
 * Номер приводим к каноническому: подтвердивший становится хозяином данных, а
 * у слитого раньше аккаунта сырой telegramId указывает на удалённую строку.
 * `registerUser` рядом — потому что обе карточки открываются по диплинку, мимо
 * обычного `/start`, и у новичка строки User ещё нет вовсе: без неё выдача
 * сессии падает на внешнем ключе WebSession → User.
 */
export async function withConfirmingUser(
  deps: ConfirmDeps,
  ctx: Context,
  what: string,
  body: (code: string, userId: bigint) => Promise<void>,
): Promise<void> {
  const rawId = ctx.from?.id;
  if (!rawId) return;
  const code = (ctx as unknown as { match: string[] }).match[1];
  try {
    const userId = await deps.accountService.canonicalUserId(rawId);
    await deps.accountService.registerUser(userId, ctx.from?.first_name);
    await body(code, userId);
  } catch (err) {
    deps.logger.error(
      `${what} failed: ${(err as Error).message}`,
      (err as Error).stack,
    );
    throw err;
  }
}

// Цикл рассылки /broadcast. Вынесен из telegram.admin.service.ts
// (правило №10): цикл вырос на темп отправки и ответ 429.
//
// Аудит 2026-10: рассылка шла с зашитой паузой 50 мс, а ответ 429 («слишком
// часто») засчитывала в ошибки и сразу слала следующему — под лимитом,
// продлевая его. Теперь тот же PacedSender, что у очереди уведомлений: на 429
// ждём retry_after и повторяем; если Telegram просит ждать дольше бюджета
// или повтор снова 429 — рассылка останавливается, и в итоге видно, скольким
// она не ушла. Заодно у отправки появился таймаут 15 с (sendBounded, #681):
// раньше рассылка ждала ответа Telegram до таймаута клиента в 500 с.
import type { Logger } from '@nestjs/common';
import type { Context, Telegraf } from 'telegraf';
import type { AccountService } from '../bot/account.service';
import { classifySendFailure } from './telegram-error';
import { PacedSender, type PaceOptions } from './telegram.paced-sender';
import { sendBounded } from './telegram.send-bounded';

// Рассылка — разовая команда админа, а не тик крона: пауза мягче очереди,
// бюджет щедрый. Но не бесконечный: retry_after в час не повод держать
// обработчик команды час.
export const BROADCAST_PAUSE_MS = 50;
export const BROADCAST_BUDGET_MS = 10 * 60_000;

export interface BroadcastDeps {
  bot: Telegraf<Context>;
  accountService: Pick<AccountService, 'markUserBlocked'>;
  logger: Logger;
  pace?: PaceOptions;
}

export interface BroadcastResult {
  sent: number;
  failed: number;
  /** Нет чата в Telegram (вход через Google, почту, MAX). */
  skipped: number;
  /** Не отправлено: Telegram попросил ждать дольше, чем есть у рассылки. */
  limited: number;
}

export async function runBroadcast(
  deps: BroadcastDeps,
  userIds: bigint[],
  chatIds: Map<string, bigint>,
  text: string,
): Promise<BroadcastResult> {
  const pacer = new PacedSender({
    pauseMs: BROADCAST_PAUSE_MS,
    budgetMs: BROADCAST_BUDGET_MS,
    ...deps.pace,
  });
  const r: BroadcastResult = { sent: 0, failed: 0, skipped: 0, limited: 0 };
  for (const [i, uid] of userIds.entries()) {
    const chatId = chatIds.get(uid.toString());
    if (chatId === undefined) {
      r.skipped++;
      continue;
    }
    try {
      // Plain text — no parse_mode: случайная разметка в тексте не должна
      // ронять рассылку половине людей. Number(chatId) — чат в Telegram
      // (< 2^53, telegraf ждёт number), не userId.
      const result = await pacer.send(() =>
        sendBounded(deps.bot, Number(chatId), text, { parse_mode: undefined }),
      );
      if (result !== 'sent') {
        r.limited = userIds
          .slice(i)
          .filter((u) => chatIds.has(u.toString())).length;
        break;
      }
      r.sent++;
    } catch (err: unknown) {
      r.failed++;
      if (classifySendFailure(err) !== 'transient') {
        await deps.accountService
          .markUserBlocked(uid)
          .catch((e) => deps.logger.warn('markUserBlocked failed', e));
      }
    }
  }
  return r;
}

/** Итог для админа. Безлично: текст читает только админ, но гейты форм
 * обращения и рода смотрят весь src/. */
export function describeBroadcastResult(r: BroadcastResult): string {
  return (
    `✅ Готово: ${r.sent} доставлено, ${r.failed} ошибок` +
    (r.skipped > 0 ? `, ${r.skipped} без чата в Telegram` : '') +
    (r.limited > 0
      ? `, ${r.limited} не отправлено: Telegram попросил подождать ` +
        `дольше, чем рассчитана рассылка`
      : '')
  );
}

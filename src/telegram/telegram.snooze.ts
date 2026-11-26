// Кнопка «⏰ Напомню через час» под напоминанием (callback `snooze_reminder`).
// Вынесено из telegram.service.ts: файл в долге храповика размера (правило №10).
//
// Честный исход (аудит 2026-10, по образцу паузы #978): тост пустой (только
// гасит спиннер), итог «⏰ Напомню в 15:30» — правкой сообщения ПОСЛЕ того, как
// напоминание встало в очередь; событие reminder_snoozed — тоже после записи
// (правило №8, /stats: notify-queue-metrics.*). Уже отложенное снимается, а
// новое ставится под локом на человека (replace-pending.ts): двойной тап до
// правки сообщения (кнопки исчезают только с итогом) не ставит двух.
import type { Context } from 'telegraf';
import type { AccountService } from '../bot/account.service';
import type { BotService } from '../bot/bot.service';
import type { NotificationService } from '../notification/notification.service';
import type { AnalyticsService } from '../analytics/analytics.service';
import {
  normalizeAddressForm,
  t,
  type AddressForm,
} from '../notification/address-form';
import { isQuietHours, nextQuietEnd } from '../notification/notification.time';
import { localTimeLabel } from '../booking/client-timezone';
import { isMessageNotModified } from './callback-failure';

export const SNOOZE_MS = 3_600_000;

export interface SnoozeDeps {
  accountService: Pick<AccountService, 'canonicalUserId'>;
  botService: Pick<BotService, 'getUserSettings'>;
  notificationService: Pick<NotificationService, 'cancel' | 'replacePending'>;
  analytics: Pick<AnalyticsService, 'track'>;
  now?: () => number;
}

/** Через час, а если час попал в тихие часы человека — к их концу. */
export function snoozeSendAt(
  nowMs: number,
  tz: string,
  quietStart: number,
  quietEnd: number,
): { at: Date; quietShift: boolean } {
  const at = new Date(nowMs + SNOOZE_MS);
  if (!isQuietHours(tz, quietStart, quietEnd, at)) {
    return { at, quietShift: false };
  }
  return { at: nextQuietEnd(tz, quietEnd, at), quietShift: true };
}

/**
 * Сбой записи, когда форма обращения уже прочитана: хендлер ответит в ней, не
 * перечитывая настройки из БД (она, скорее всего, и упала).
 */
export class SnoozeFailed extends Error {
  constructor(
    readonly form: AddressForm,
    readonly reason: unknown,
  ) {
    super(reason instanceof Error ? reason.message : String(reason));
    if (reason instanceof Error) this.stack = reason.stack;
  }
}

/**
 * Текст сбоя: в форме человека, если её успели прочитать (SnoozeFailed), иначе
 * «ты», как до выбора. Напоминание с кнопками остаётся — нажать можно ещё раз.
 */
export function snoozeFailText(err?: unknown): string {
  return t(
    err instanceof SnoozeFailed ? err.form : undefined,
    'Не получилось отложить напоминание. Попробуй нажать ещё раз.',
    'Не получилось отложить напоминание. Попробуйте нажать ещё раз.',
  );
}

/**
 * Отложить напоминание и показать, когда оно придёт. Бросает на сбое —
 * исход сбоя сообщает хендлер (telegram.service.ts).
 */
export async function snoozeReminder(
  deps: SnoozeDeps,
  ctx: Context,
  rawId: number,
): Promise<void> {
  const userId = await deps.accountService.canonicalUserId(rawId);
  const settings = await deps.botService.getUserSettings(userId);
  const tz = settings?.notifyTimezone ?? 'Europe/Moscow';
  const { at: sendAt, quietShift } = snoozeSendAt(
    (deps.now ?? Date.now)(),
    tz,
    settings?.notifyQuietStart ?? 22,
    settings?.notifyQuietEnd ?? 8,
  );
  try {
    const queue = deps.notificationService;
    await queue.cancel(userId, 'reminder');
    await queue.replacePending(userId, 'pre_reminder', sendAt);
  } catch (err) {
    throw new SnoozeFailed(normalizeAddressForm(settings?.addressForm), err);
  }
  void deps.analytics.track(userId, 'reminder_snoozed', { quietShift });
  const done = `⏰ Напомню в ${localTimeLabel(sendAt, tz)}`;
  // Тост пустой — итог обязан дойти: не вышло поправить сообщение (удалено,
  // не редактируется) — новым сообщением. «Не изменено» — двойной тап, успех.
  await ctx.editMessageText(done).catch((err: unknown) => {
    if (isMessageNotModified(err)) return null;
    return ctx.reply(done).catch(() => null);
  });
}

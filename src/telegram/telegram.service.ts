import { Injectable, OnModuleInit, OnModuleDestroy, Inject, Optional, Logger } from '@nestjs/common';
import { Telegraf, Context, Markup } from 'telegraf';
import { TELEGRAF_BOT, MINIAPP_URL, SUBSCRIBE_URL, DONATE_URL } from './telegram.constants';
import { BotService } from '../bot/bot.service';
import { BotAnalyticsService } from '../bot/bot.analytics.service';
import { NotificationService } from '../notification/notification.service';
import { TherapyService } from '../therapy/therapy.service';
import { TherapistRequestService } from '../therapy/therapist-request.service';

function tzOffsetAt(tz: string, date = new Date()): number {
  const utc = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  const local = new Date(date.toLocaleString('en-US', { timeZone: tz }));
  return Math.round((local.getTime() - utc.getTime()) / 3_600_000);
}

function nextSendAtHour(localHour: number, tz: string): Date {
  const now = new Date();
  for (let daysAhead = 0; daysAhead <= 1; daysAhead++) {
    const probe = new Date(now.getTime() + daysAhead * 86_400_000);
    const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(probe);
    const noonRef = new Date(`${dateStr}T12:00:00.000Z`);
    const offset = tzOffsetAt(tz, noonRef);
    const candidate = new Date(`${dateStr}T${String(localHour).padStart(2, '0')}:00:00.000Z`);
    candidate.setTime(candidate.getTime() - offset * 3_600_000);
    if (candidate > now) return candidate;
  }
  const probe2 = new Date(now.getTime() + 2 * 86_400_000);
  const dateStr2 = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(probe2);
  const noonRef2 = new Date(`${dateStr2}T12:00:00.000Z`);
  const offset2 = tzOffsetAt(tz, noonRef2);
  const result = new Date(`${dateStr2}T${String(localHour).padStart(2, '0')}:00:00.000Z`);
  result.setTime(result.getTime() - offset2 * 3_600_000);
  return result;
}

const WELCOME_TEXT = `Привет!

Бывает, что день прошёл нормально — а внутри что-то не так. Или наоборот, всё объективно сложно, но ощущение живое и устойчивое.

Дело почти всегда в потребностях. «Всё по схеме» помогает это увидеть — трекер, дневники схема-терапии и YSQ-тест в одном месте.`;

const CONSENT_TEXT = `🔐 Соглашение об обработке данных

Прежде чем начать:

• Твои данные (оценки, дневники, планы) хранятся на защищённом сервере и привязаны к Telegram ID
• Данные не передаются третьим лицам
• Ты можешь удалить всё в любой момент через Настройки → Удалить данные
• Приложение не является медицинским инструментом и не заменяет психотерапию

Нажимая «Принять», ты соглашаешься с этими условиями.`;

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function buildWelcomeKeyboard(): any {
  return Markup.inlineKeyboard([
    [Markup.button.webApp('🧠 Открыть «Всё по схеме»', MINIAPP_URL)],
  ]);
}

function buildConsentKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('✅ Принять и продолжить', 'accept_consent')],
  ]);
}

@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramService.name);

  constructor(
    @Inject(TELEGRAF_BOT) @Optional() private readonly bot: Telegraf<Context> | null,
    private readonly botService: BotService,
    private readonly analyticsService: BotAnalyticsService,
    private readonly notificationService: NotificationService,
    private readonly therapyService: TherapyService,
    private readonly therapistRequestService: TherapistRequestService,
  ) {}

  private stopping = false;
  // Pending pair codes for users who need to accept consent first (in-memory, 15 min TTL)
  private readonly pendingPairCodes = new Map<number, { code: string; expiresAt: number }>();

  async onModuleInit() {
    if (!this.bot) {
      this.logger.warn('BOT_TOKEN not provided — bot will not start.');
      return;
    }

    // Sweep expired pair-code entries every 30 min so the in-memory map
    // doesn't accumulate stale entries from users who never completed consent.
    setInterval(() => {
      const now = Date.now();
      for (const [uid, entry] of this.pendingPairCodes) {
        if (entry.expiresAt < now) this.pendingPairCodes.delete(uid);
      }
    }, 30 * 60_000).unref();

    const redirectUsername = process.env.BOT_REDIRECT_USERNAME;
    if (redirectUsername) {
      const redirectText = `Бот переехал! Открывай @${redirectUsername}`;
      this.bot.on('message', async (ctx) => { await ctx.reply(redirectText).catch(() => null); });
      this.bot.on('callback_query', async (ctx) => {
        await (ctx as any).answerCbQuery(redirectText, { show_alert: true }).catch(() => null);
      });
      this.bot.launch({ dropPendingUpdates: true }).catch((err) => {
        this.logger.error('Redirect-mode bot failed to launch', err);
      });
      this.logger.log(`Bot running in redirect mode → @${redirectUsername}`);
      return;
    }

    this.bot.command('start', async (ctx) => {
      try {
        const rawId = ctx.from?.id;
        if (!rawId) return;
        const userId = BigInt(rawId);
        const isReturning = !!(await this.botService.getUserSettings(userId));
        await this.botService.registerUser(userId, ctx.from?.first_name);
        const payload = (ctx as any).startPayload as string | undefined;
        if (payload?.startsWith('pair_')) {
          const code = payload.slice(5).toUpperCase();
          const hasConsent = await this.botService.hasAcceptedDisclaimer(userId);
          if (!hasConsent) {
            this.pendingPairCodes.set(rawId, { code, expiresAt: Date.now() + 15 * 60_000 });
            await ctx.reply(CONSENT_TEXT, buildConsentKeyboard());
            return;
          }
          const ok = await this.botService.joinPair(userId, code);
          if (ok) {
            await ctx.reply('Вы в паре! 🤝 Теперь будете видеть индекс дня друг друга.',
              Markup.inlineKeyboard([[Markup.button.webApp('🧠 Открыть Схему', MINIAPP_URL)]]));
          } else {
            await ctx.reply('Ссылка недействительна или уже использована.',
              Markup.inlineKeyboard([[Markup.button.webApp('🧠 Открыть Схему', MINIAPP_URL)]]));
          }
          return;
        }
        const hasConsent2 = await this.botService.hasAcceptedDisclaimer(userId);
        if (!hasConsent2) {
          await ctx.reply(CONSENT_TEXT, buildConsentKeyboard());
          return;
        }
        if (isReturning) {
          const streak = await this.analyticsService.getConsecutiveDays(userId);
          const name = ctx.from?.first_name ? ` ${ctx.from.first_name}` : '';
          const streakLine = streak >= 3
            ? `\n🔥 Серия: ${streak} ${streak < 5 ? 'дня' : 'дней'} подряд`
            : '';
          await ctx.reply(`С возвращением${name}!${streakLine}`, buildWelcomeKeyboard());
        } else {
          await ctx.reply(WELCOME_TEXT, buildWelcomeKeyboard());
        }
      } catch (err) {
        this.logger.error('start command failed', err);
        await ctx.reply('Что-то пошло не так. Попробуй открыть «Всё по схеме» через кнопку ниже.',
          Markup.inlineKeyboard([[Markup.button.webApp('🧠 Открыть Схему', MINIAPP_URL)]])).catch(() => null);
      }
    });


    this.bot.command('ping', async (ctx) => {
      try {
        await ctx.reply('OK');
      } catch (err) {
        this.logger.error('ping command failed', err);
      }
    });

    this.bot.command('subscribe', async (ctx) => {
      try {
        await ctx.reply(
          '💛 <b>Подписка на SchemeHappens</b>\n\n' +
          'Приложение бесплатное. Регулярная поддержка помогает его развивать — ' +
          'можно оформить ежемесячную или годовую подписку, отписаться в любой момент.',
          {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [{ text: 'Оформить подписку', url: SUBSCRIBE_URL }],
                [{ text: 'Разовый донат', url: DONATE_URL }],
              ],
            },
          },
        );
      } catch (err) {
        this.logger.error('subscribe command failed', err);
      }
    });

    this.bot.command('stats', async (ctx) => {
      try {
        const adminId = Number(process.env.ADMIN_ID);
        if (!adminId || ctx.from?.id !== adminId) { await ctx.reply('⛔ Нет доступа'); return; }
        const text = await this.analyticsService.getAdminStats();
        await ctx.reply(text, { parse_mode: 'HTML' });
      } catch (err) {
        this.logger.error('stats command failed', err);
        await ctx.reply(`❌ ${String(err).slice(0, 300)}`).catch(() => null);
      }
    });

    this.bot.action('cancel', async (ctx) => {
      try {
        await ctx.answerCbQuery();
        await ctx.deleteMessage();
      } catch (err) {
        this.logger.error('cancel action failed', err);
      }
    });

    this.bot.action('back:welcome', async (ctx) => {
      try {
        await ctx.answerCbQuery();
        try {
          await ctx.editMessageText(WELCOME_TEXT, buildWelcomeKeyboard() as any);
        } catch {
          await ctx.reply(WELCOME_TEXT, buildWelcomeKeyboard());
        }
      } catch (err) {
        this.logger.error('back:welcome action failed', err);
      }
    });

    this.bot.action('accept_consent', async (ctx) => {
      try {
        await ctx.answerCbQuery('Принято ✅');
        const rawId = ctx.from?.id;
        if (rawId) {
          const userId = BigInt(rawId);
          await this.botService.acceptDisclaimer(userId);
          // Resume pending pair join if user arrived via pair invite link
          const pending = this.pendingPairCodes.get(rawId);
          if (pending && pending.expiresAt > Date.now()) {
            this.pendingPairCodes.delete(rawId);
            const ok = await this.botService.joinPair(userId, pending.code);
            const text = ok
              ? 'Вы в паре! 🤝 Теперь будете видеть индекс дня друг друга.'
              : 'Ссылка недействительна или уже использована.';
            try { await ctx.editMessageText(text, Markup.inlineKeyboard([[Markup.button.webApp('🧠 Открыть Схему', MINIAPP_URL)]]) as any); }
            catch { await ctx.reply(text, Markup.inlineKeyboard([[Markup.button.webApp('🧠 Открыть Схему', MINIAPP_URL)]])); }
            return;
          }
        }
        try {
          await ctx.editMessageText(WELCOME_TEXT, buildWelcomeKeyboard() as any);
        } catch {
          await ctx.reply(WELCOME_TEXT, buildWelcomeKeyboard());
        }
      } catch (err) {
        this.logger.error('accept_consent action failed', err);
        await ctx.editMessageText('Что-то пошло не так. Попробуй нажать ещё раз.').catch(() => null);
      }
    });

    // ─── Therapist-request admin callbacks ──────────────────────────────────
    // Inline buttons attached to admin notification messages. Only the admin
    // ID may trigger these.
    this.bot.action(/^treq:(approve|reject):(\d+)$/, async (ctx) => {
      try {
        const adminId = Number(process.env.ADMIN_ID);
        if (!adminId || ctx.from?.id !== adminId) { await ctx.answerCbQuery('Только админ'); return; }
        const match = (ctx as any).match as RegExpMatchArray;
        const action = match[1] as 'approve' | 'reject';
        const reqId = parseInt(match[2], 10);
        if (action === 'approve') {
          await this.therapistRequestService.approve(adminId, reqId);
          await ctx.answerCbQuery('✅ Одобрено');
          await ctx.editMessageReplyMarkup(undefined).catch(() => null);
          await ctx.reply(`Заявка #${reqId} одобрена`);
        } else {
          // Reject without reason in the inline-button path; for a reason
          // admin should reply to the notification with "/reject <id> <reason>".
          await this.therapistRequestService.reject(adminId, reqId, '');
          await ctx.answerCbQuery('❌ Отклонено');
          await ctx.editMessageReplyMarkup(undefined).catch(() => null);
          await ctx.reply(`Заявка #${reqId} отклонена`);
        }
      } catch (err) {
        this.logger.error(`treq action failed: ${(err as Error).message}`);
        await ctx.answerCbQuery('Ошибка').catch(() => null);
      }
    });

    this.bot.action('snooze_reminder', async (ctx) => {
      try {
        await ctx.answerCbQuery('⏰ Напомню через час');
        const rawId = ctx.from?.id;
        if (rawId) {
          const userId = BigInt(rawId);
          const settings = await this.botService.getUserSettings(userId);
          const tz = settings?.notifyTimezone ?? 'Europe/Moscow';
          let sendAt = new Date(Date.now() + 3_600_000);
          // Quiet hours: if local hour >= 22 or < 7, push to 8:00 next morning
          const offsetNow = tzOffsetAt(tz, sendAt);
          const localHour = ((sendAt.getUTCHours() + offsetNow) % 24 + 24) % 24;
          if (localHour >= 22 || localHour < 7) {
            sendAt = nextSendAtHour(8, tz);
          }
          await this.notificationService.cancel(userId, 'reminder');
          await this.notificationService.schedule(userId, 'pre_reminder', sendAt);
          const offsetSend = tzOffsetAt(tz, sendAt);
          const localHourSend = ((sendAt.getUTCHours() + offsetSend) % 24 + 24) % 24;
          const localMinSend = sendAt.getUTCMinutes();
          const timeStr = `${String(localHourSend).padStart(2, '0')}:${String(localMinSend).padStart(2, '0')}`;
          await ctx.editMessageText(`⏰ Напомню в ${timeStr}`).catch(() =>
            ctx.editMessageReplyMarkup(undefined).catch(() => null)
          );
        } else {
          await ctx.editMessageReplyMarkup(undefined).catch(() => null);
        }
      } catch (err) {
        this.logger.error('snooze_reminder action failed', err);
        await ctx.editMessageText('Не удалось перенести напоминание. Попробуй ещё раз.').catch(() => null);
      }
    });

    // Plan check-in: plan_done:<planId> / plan_skip:<planId>
    this.bot.action(/^plan_(done|skip):(\d+)$/, async (ctx) => {
      try {
        await ctx.answerCbQuery();
        const rawId = ctx.from?.id;
        if (!rawId) return;
        const userId = BigInt(rawId);
        const match = ctx.match as RegExpMatchArray;
        const done = match[1] === 'done';
        const planId = Number(match[2]);
        await this.botService.checkinPlan(userId, planId, done);
        const reply = done ? '✅ Отлично! Записал.' : '❌ Бывает. Можно попробовать завтра.';
        await ctx.editMessageText(reply).catch(() => ctx.editMessageReplyMarkup(undefined).catch(() => null));
      } catch (err) {
        this.logger.error('plan checkin action failed', err);
        await ctx.editMessageText('Не удалось сохранить. Попробуй ещё раз.').catch(() => null);
      }
    });

    this.bot.command('therapist', async (ctx) => {
      // DEPRECATED: was `/therapist <THERAPIST_CODE>` — bypassed the new
      // admin-approval flow. Redirect users to the mini-app form.
      try {
        await ctx.reply(
          '🩺 Заявка на роль психолога теперь подаётся через настройки приложения:\n' +
          'Открой мини-апп → Настройки → "Я психолог" → заполни форму.\n' +
          'Админ проверит и одобрит.',
        );
      } catch (err) {
        this.logger.error('therapist command failed', err);
      }
    });

    this.bot.command('broadcast', async (ctx) => {
      try {
        const adminId = Number(process.env.ADMIN_ID);
        if (!adminId || ctx.from?.id !== adminId) { await ctx.reply('⛔ Нет доступа'); return; }
        const text = ((ctx.message as any)?.text as string | undefined)?.slice('/broadcast '.length).trim();
        if (!text) { await ctx.reply('Укажи текст: /broadcast <сообщение>'); return; }
        const userIds = await this.botService.getBroadcastUserIds();
        await ctx.reply(`Начинаю рассылку для ${userIds.length} пользователей...`);
        let sent = 0, failed = 0;
        for (const uid of userIds) {
          try {
            // Plain text — no parse_mode. Avoids stray markdown chars from
            // breaking the broadcast for half the users.
            await this.bot!.telegram.sendMessage(uid, text, { parse_mode: undefined });
            sent++;
          } catch (err: any) {
            failed++;
            const code = err?.response?.error_code;
            const desc = String(err?.response?.description ?? err?.message ?? '');
            const isPermanent = code === 403
              || (code === 400 && /chat not found|user is deactivated|bot was blocked/i.test(desc));
            if (isPermanent) {
              await this.botService.markUserBlocked(BigInt(uid)).catch(() => null);
            }
          }
          await new Promise(r => setTimeout(r, 50));
        }
        await ctx.reply(`✅ Готово: ${sent} доставлено, ${failed} ошибок`);
      } catch (err) {
        this.logger.error('broadcast command failed', err);
        await ctx.reply('❌ Ошибка рассылки').catch(() => null);
      }
    });

    this.bot.command('about', async (ctx) => {
      try {
        const text = [
          '🧠 <b>Всё по схеме</b>',
          '',
          'Инструмент самопознания на основе схема-терапии: трекер потребностей, дневники схем и режимов, тесты, практики и пространство для работы с терапевтом.',
          '',
          '<b>Об авторе</b>',
          'Канал о схема-терапии — @SchemeHappens',
          'Записаться на сессию — @kotlarewski',
        ].join('\n');
        await ctx.reply(text, { parse_mode: 'HTML' });
      } catch (err) {
        this.logger.error('about command failed', err);
        await ctx.reply('Не удалось загрузить информацию.').catch(() => null);
      }
    });

    await this.bot.telegram.setMyCommands([
      { command: 'start', description: 'Открыть «Всё по схеме»' },
      { command: 'settings', description: 'Настройки уведомлений' },
      { command: 'subscribe', description: 'Подписка и поддержка проекта' },
      { command: 'about', description: 'О приложении и авторе' },
    ]).catch((err) => this.logger.error('setMyCommands failed', err));

    await this.bot.telegram.callApi('setChatMenuButton' as any, {
      menu_button: { type: 'web_app', text: 'Всё по схеме', web_app: { url: MINIAPP_URL } },
    }).catch((err: unknown) => this.logger.warn('setChatMenuButton failed', err));

    this.bot.launch({ dropPendingUpdates: true }).catch((err) => {
      const msg = String(err);
      if (!msg.includes('409') && !msg.includes('terminated by other') && !this.stopping) {
        this.logger.error('Failed to launch bot', err);
      }
    });
    this.logger.log('Bot launched');
    const adminId = process.env.ADMIN_ID;
    if (adminId) {
      this.bot.telegram.sendMessage(adminId, '🚀 Деплой завершён').catch(() => null);
    }

    // One-time cleanup: cancel legacy pre_reminder notifications left in queue
    this.botService.cancelAllPreReminders().then(n => {
      if (n > 0) this.logger.log(`Cancelled ${n} legacy pre_reminder notifications`);
    }).catch(() => null);
  }

  /** Отправить сообщение администратору. Возвращает true, если доставлено. */
  async notifyAdmin(text: string): Promise<boolean> {
    const adminId = process.env.ADMIN_ID;
    if (!adminId || !this.bot) return false;
    try {
      await this.bot.telegram.sendMessage(adminId, text, { parse_mode: 'HTML' });
      return true;
    } catch (err) {
      this.logger.error('notifyAdmin failed', err);
      return false;
    }
  }

  async onModuleDestroy() {
    this.stopping = true;
    try {
      await this.bot?.stop();
    } catch { /* expected on graceful shutdown */ }
  }
}

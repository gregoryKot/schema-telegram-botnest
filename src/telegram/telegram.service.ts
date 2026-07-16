import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Inject,
  Optional,
  Logger,
} from '@nestjs/common';
import { Telegraf, Context, Markup } from 'telegraf';
import { TELEGRAF_BOT, MINIAPP_URL, DONATE_URL } from './telegram.constants';
import { renderTemplate } from '../notification/notification.templates';
import { BotService } from '../bot/bot.service';
import { BotAnalyticsService } from '../bot/bot.analytics.service';
import { AccountService } from '../bot/account.service';
import { PairsService } from '../bot/pairs.service';
import { PracticesService } from '../bot/practices.service';
import { NotificationService } from '../notification/notification.service';
import { TherapistRequestService } from '../therapy/therapist-request.service';
import { TelegramChannelService } from './telegram.channel.service';
import {
  isQuietHours,
  nextQuietEnd,
  tzOffsetAt,
} from '../notification/notification.time';
import { adminIdNum, isAdminSender } from '../utils/admin-alert';
import { retryWithBackoff } from '../utils/retry';
import { t, AddressForm } from '../notification/address-form';

export const WELCOME_TEXT = `Привет!

Бывает, что день прошёл нормально — а внутри что-то не так. Или наоборот, всё объективно сложно, но ощущение живое и устойчивое.

Дело почти всегда в потребностях. «Всё по схеме» помогает это увидеть — трекер, дневники схема-терапии и тест на схемы в одном месте.`;

const CONSENT_TEXT = `🔐 Соглашение об обработке данных

Прежде чем начать:

• Твои данные (оценки, дневники, планы) хранятся на защищённом сервере в зашифрованном виде и привязаны к Telegram ID
• Записи и ответы на опросники могут касаться твоего психоэмоционального состояния — принимая соглашение, ты даёшь отдельное согласие на обработку таких сведений
• Данные не передаются третьим лицам — кроме терапевта, если ты сам решишь подключить его по коду, и технической инфраструктуры (подробнее: schemehappens.ru/privacy)
• Ты можешь удалить всё в любой момент через Настройки → Удалить данные
• Приложение не является медицинским инструментом и не заменяет психотерапию
• Сервис предназначен для пользователей старше 18 лет

Кнопка ниже — это согласие с условиями, подтверждение 18+ и выбор формы обращения (поменять можно в любой момент в /settings).`;

export function buildWelcomeKeyboard(): any {
  return Markup.inlineKeyboard([
    [Markup.button.webApp('🧠 Открыть «Всё по схеме»', MINIAPP_URL)],
    [Markup.button.url('💛 Поддержать проект', DONATE_URL)],
  ]);
}

// Онбординг −1 шаг (аудит 2026-07, этап 4.3): согласие и выбор ты/вы — один
// экран с двумя кнопками вместо двух последовательных сообщений.
function buildConsentKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('✅ Принять — общаемся на «ты»', 'accept:ty')],
    [Markup.button.callback('✅ Принять — на «вы»', 'accept:vy')],
  ]);
}

const ADDRESS_PROMPT =
  'Один вопрос, чтобы дальше было комфортно: как удобнее общаться?';

export function buildAddressKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('На «ты»', 'addr:ty'),
      Markup.button.callback('На «вы»', 'addr:vy'),
    ],
  ]);
}

@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramService.name);

  constructor(
    @Inject(TELEGRAF_BOT)
    @Optional()
    private readonly bot: Telegraf<Context> | null,
    private readonly botService: BotService,
    private readonly analyticsService: BotAnalyticsService,
    private readonly accountService: AccountService,
    private readonly pairsService: PairsService,
    private readonly practicesService: PracticesService,
    private readonly notificationService: NotificationService,
    private readonly therapistRequestService: TherapistRequestService,
    private readonly channelService: TelegramChannelService,
  ) {}

  private stopping = false;
  // Pending pair codes for users who need to accept consent first (in-memory, 15 min TTL)
  private readonly pendingPairCodes = new Map<
    number,
    { code: string; expiresAt: number }
  >();

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
      this.bot.on('message', async (ctx) => {
        await ctx.reply(redirectText).catch(() => null);
      });
      this.bot.on('callback_query', async (ctx) => {
        await (ctx as any)
          .answerCbQuery(redirectText, { show_alert: true })
          .catch(() => null);
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
        const existingSettings = await this.botService.getUserSettings(userId);
        const isReturning = !!existingSettings;
        await this.accountService.registerUser(userId, ctx.from?.first_name);
        const payload = (ctx as any).startPayload as string | undefined;
        if (payload?.startsWith('pair_')) {
          const code = payload.slice(5).toUpperCase();
          const hasConsent =
            await this.botService.hasAcceptedDisclaimer(userId);
          if (!hasConsent) {
            this.pendingPairCodes.set(rawId, {
              code,
              expiresAt: Date.now() + 15 * 60_000,
            });
            await ctx.reply(CONSENT_TEXT, buildConsentKeyboard());
            return;
          }
          const ok = await this.pairsService.joinPair(userId, code);
          if (ok) {
            await ctx.reply(
              'Вы в паре! 🤝 Теперь будете видеть индекс дня друг друга.',
              Markup.inlineKeyboard([
                [Markup.button.webApp('🧠 Открыть Схему', MINIAPP_URL)],
              ]),
            );
          } else {
            await ctx.reply(
              'Ссылка недействительна или уже использована.',
              Markup.inlineKeyboard([
                [Markup.button.webApp('🧠 Открыть Схему', MINIAPP_URL)],
              ]),
            );
          }
          return;
        }
        const hasConsent2 = await this.botService.hasAcceptedDisclaimer(userId);
        if (!hasConsent2) {
          await ctx.reply(CONSENT_TEXT, buildConsentKeyboard());
          return;
        }
        // Форма обращения ещё не выбрана — спросить до приветствия
        if (!existingSettings?.addressForm) {
          await ctx.reply(ADDRESS_PROMPT, buildAddressKeyboard());
          return;
        }
        if (isReturning) {
          const streak = await this.analyticsService.getConsecutiveDays(userId);
          const name = ctx.from?.first_name ? ` ${ctx.from.first_name}` : '';
          const streakLine =
            streak >= 3
              ? `\n🔥 Серия: ${streak} ${streak < 5 ? 'дня' : 'дней'} подряд`
              : '';
          await ctx.reply(
            `С возвращением${name}!${streakLine}`,
            buildWelcomeKeyboard(),
          );
        } else {
          await ctx.reply(WELCOME_TEXT, buildWelcomeKeyboard());
        }
      } catch (err) {
        this.logger.error('start command failed', err);
        await ctx
          .reply(
            'Что-то пошло не так. Попробуй открыть «Всё по схеме» через кнопку ниже.',
            Markup.inlineKeyboard([
              [Markup.button.webApp('🧠 Открыть Схему', MINIAPP_URL)],
            ]),
          )
          .catch(() => null);
      }
    });

    this.bot.command('ping', async (ctx) => {
      try {
        await ctx.reply('OK');
      } catch (err) {
        this.logger.error('ping command failed', err);
      }
    });

    // Subscription is hidden until Robokassa's recurring service is live, so this
    // command currently offers only a one-off donation. Re-add the subscribe
    // button (SUBSCRIBE_URL) when subscriptions go live.
    this.bot.command('subscribe', async (ctx) => {
      try {
        await ctx.reply(
          '💛 <b>Поддержать SchemeHappens</b>\n\n' +
            'Приложение бесплатное. Если оно полезно — можно поддержать проект разовым донатом.',
          {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [[{ text: 'Разовый донат', url: DONATE_URL }]],
            },
          },
        );
      } catch (err) {
        this.logger.error('subscribe command failed', err);
      }
    });

    this.bot.command('donate', async (ctx) => {
      const text =
        '💛 <b>Поддержать SchemeHappens</b>\n\n' +
        'Приложение бесплатное и без рекламы. Если оно тебе помогает — поддержи проект любой суммой. Спасибо 🙏';
      try {
        await ctx.reply(text, {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '💛 Поддержать проект', url: DONATE_URL }],
            ],
          },
        });
      } catch (err) {
        // If the inline button is rejected (e.g. an invalid URL), still give the
        // user a working plain-text link instead of failing silently.
        this.logger.error('donate command failed', err);
        await ctx
          .reply(`${text}\n\n${DONATE_URL}`, { parse_mode: 'HTML' })
          .catch(() => null);
      }
    });

    // Admin-only: preview the monthly donate reminder immediately (the real one
    // fires 1st of each month). Lets us verify text + button without waiting.
    this.bot.command('testdonate', async (ctx) => {
      try {
        if (!isAdminSender(ctx.from)) {
          await ctx.reply('⛔ Нет доступа');
          return;
        }
        const t = renderTemplate('donate_reminder', { seed: 0 });
        if (t)
          await ctx.reply(
            t.text,
            t.keyboard ? { reply_markup: t.keyboard.reply_markup } : {},
          );
      } catch (err) {
        this.logger.error('testdonate command failed', err);
      }
    });

    this.bot.command('stats', async (ctx) => {
      try {
        if (!isAdminSender(ctx.from)) {
          await ctx.reply('⛔ Нет доступа');
          return;
        }
        const text = await this.analyticsService.getAdminStats();
        await ctx.reply(text, { parse_mode: 'HTML' });
      } catch (err) {
        this.logger.error('stats command failed', err);
        await ctx.reply(`❌ ${String(err).slice(0, 300)}`).catch(() => null);
      }
    });

    // Ручная публикация фразы «Здорового Взрослого» в канал — для проверки
    // связки (env + права бота), т.к. по расписанию пост выходит только в
    // 09:00/20:00 МСК и «сразу после настройки» ничего не публикуется.
    this.bot.command('zv', async (ctx) => {
      try {
        if (!isAdminSender(ctx.from)) {
          await ctx.reply('⛔ Нет доступа');
          return;
        }
        const result = await this.channelService.post();
        await ctx.reply(result.message);
      } catch (err) {
        this.logger.error('zv command failed', err);
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
          await ctx.editMessageText(WELCOME_TEXT, buildWelcomeKeyboard());
        } catch {
          await ctx.reply(WELCOME_TEXT, buildWelcomeKeyboard());
        }
      } catch (err) {
        this.logger.error('back:welcome action failed', err);
      }
    });

    // Единый экран согласия: кнопка = согласие + 18+ + форма обращения
    // (этап 4.3 — на один шаг меньше до полезного контента).
    this.bot.action(/^accept:(ty|vy)$/, async (ctx) => {
      try {
        await ctx.answerCbQuery('Принято ✅');
        const rawId = ctx.from?.id;
        if (!rawId) return;
        const form = (ctx.match as RegExpMatchArray)[1] as AddressForm;
        const userId = BigInt(rawId);
        await this.botService.acceptDisclaimer(userId);
        await this.botService.updateUserSettings(userId, {
          addressForm: form,
        });
        if (await this.resumePendingPair(ctx, rawId)) return;
        const ack = t(
          form,
          'Договорились, на «ты». Поменять можно в любой момент в /settings.',
          'Договорились, на «вы». Поменять можно в любой момент в /settings.',
        );
        const welcome = t(
          form,
          WELCOME_TEXT,
          WELCOME_TEXT.replace('Привет!', 'Здравствуйте!'),
        );
        try {
          await ctx.editMessageText(
            `${ack}\n\n${welcome}`,
            buildWelcomeKeyboard(),
          );
        } catch {
          await ctx.reply(`${ack}\n\n${welcome}`, buildWelcomeKeyboard());
        }
      } catch (err) {
        this.logger.error('accept action failed', err);
        await ctx
          .editMessageText('Что-то пошло не так. Попробуй нажать ещё раз.')
          .catch(() => null);
      }
    });

    // Легаси-кнопка старых consent-сообщений, уже отправленных в чаты до
    // объединения экранов: принимаем согласие и спрашиваем форму отдельно.
    this.bot.action('accept_consent', async (ctx) => {
      try {
        await ctx.answerCbQuery('Принято ✅');
        const rawId = ctx.from?.id;
        if (rawId) {
          await this.botService.acceptDisclaimer(BigInt(rawId));
          if (await this.resumePendingPair(ctx, rawId)) return;
        }
        // После согласия — сразу выбор обращения, приветствие покажет addr-хендлер
        try {
          await ctx.editMessageText(ADDRESS_PROMPT, buildAddressKeyboard());
        } catch {
          await ctx.reply(ADDRESS_PROMPT, buildAddressKeyboard());
        }
      } catch (err) {
        this.logger.error('accept_consent action failed', err);
        await ctx
          .editMessageText('Что-то пошло не так. Попробуй нажать ещё раз.')
          .catch(() => null);
      }
    });

    // ─── Therapist-request admin callbacks ──────────────────────────────────
    // (resumePendingPair — приватный метод класса ниже, общий для обоих
    // consent-хендлеров.)
    // Inline buttons attached to admin notification messages. Only the admin
    // ID may trigger these.
    this.bot.action(/^treq:(approve|reject):(\d+)$/, async (ctx) => {
      try {
        const adminId = adminIdNum();
        if (!adminId || ctx.from?.id !== adminId) {
          await ctx.answerCbQuery('Только админ');
          return;
        }
        const match = (ctx as any).match as RegExpMatchArray;
        const action = match[1] as 'approve' | 'reject';
        const reqId = parseInt(match[2], 10);
        // answerCbQuery ДО обращения к БД — иначе при зависшем approve/reject
        // Telegram крутит вечный спиннер на кнопке (правило CLAUDE.md).
        await ctx.answerCbQuery(
          action === 'approve' ? '✅ Одобряю…' : '❌ Отклоняю…',
        );
        if (action === 'approve') {
          await this.therapistRequestService.approve(adminId, reqId);
          await ctx.editMessageReplyMarkup(undefined).catch(() => null);
          await ctx.reply(`Заявка #${reqId} одобрена`);
        } else {
          // Reject without reason in the inline-button path; for a reason
          // admin should reply to the notification with "/reject <id> <reason>".
          await this.therapistRequestService.reject(adminId, reqId, '');
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
          const quietStart = settings?.notifyQuietStart ?? 22;
          const quietEnd = settings?.notifyQuietEnd ?? 8;
          let sendAt = new Date(Date.now() + 3_600_000);
          // Тихие часы юзера: если «через час» попадает в тишину — переносим на их конец
          if (isQuietHours(tz, quietStart, quietEnd, sendAt)) {
            sendAt = nextQuietEnd(tz, quietEnd, sendAt);
          }
          await this.notificationService.cancel(userId, 'reminder');
          await this.notificationService.schedule(
            userId,
            'pre_reminder',
            sendAt,
          );
          const offsetSend = tzOffsetAt(tz, sendAt);
          const localHourSend =
            (((sendAt.getUTCHours() + offsetSend) % 24) + 24) % 24;
          const localMinSend = sendAt.getUTCMinutes();
          const timeStr = `${String(localHourSend).padStart(2, '0')}:${String(localMinSend).padStart(2, '0')}`;
          await ctx
            .editMessageText(`⏰ Напомню в ${timeStr}`)
            .catch(() =>
              ctx.editMessageReplyMarkup(undefined).catch(() => null),
            );
        } else {
          await ctx.editMessageReplyMarkup(undefined).catch(() => null);
        }
      } catch (err) {
        this.logger.error('snooze_reminder action failed', err);
        await ctx
          .editMessageText(
            'Не удалось перенести напоминание. Попробуй ещё раз.',
          )
          .catch(() => null);
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
        await this.practicesService.checkinPlan(userId, planId, done);
        const reply = done
          ? '✅ Отлично! Записал.'
          : '❌ Бывает. Можно попробовать завтра.';
        await ctx
          .editMessageText(reply)
          .catch(() => ctx.editMessageReplyMarkup(undefined).catch(() => null));
      } catch (err) {
        this.logger.error('plan checkin action failed', err);
        await ctx
          .editMessageText('Не удалось сохранить. Попробуй ещё раз.')
          .catch(() => null);
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
        if (!isAdminSender(ctx.from)) {
          await ctx.reply('⛔ Нет доступа');
          return;
        }
        const text = ((ctx.message as any)?.text as string | undefined)
          ?.slice('/broadcast '.length)
          .trim();
        if (!text) {
          await ctx.reply('Укажи текст: /broadcast <сообщение>');
          return;
        }
        const userIds = await this.accountService.getBroadcastUserIds();
        await ctx.reply(
          `Начинаю рассылку для ${userIds.length} пользователей...`,
        );
        let sent = 0,
          failed = 0;
        for (const uid of userIds) {
          try {
            // Plain text — no parse_mode. Avoids stray markdown chars from
            // breaking the broadcast for half the users.
            await this.bot!.telegram.sendMessage(uid, text, {
              parse_mode: undefined,
            });
            sent++;
          } catch (err: any) {
            failed++;
            const code = err?.response?.error_code;
            const desc = String(
              err?.response?.description ?? err?.message ?? '',
            );
            const isPermanent =
              code === 403 ||
              (code === 400 &&
                /chat not found|user is deactivated|bot was blocked/i.test(
                  desc,
                ));
            if (isPermanent) {
              await this.accountService
                .markUserBlocked(BigInt(uid))
                .catch(() => null);
            }
          }
          await new Promise((r) => setTimeout(r, 50));
        }
        await ctx.reply(`✅ Готово: ${sent} доставлено, ${failed} ошибок`);
      } catch (err) {
        this.logger.error('broadcast command failed', err);
        await ctx.reply('❌ Ошибка рассылки').catch(() => null);
      }
    });

    this.bot.command('about', async (ctx) => {
      const text = [
        '🧠 <b>Всё по схеме</b>',
        '',
        'Инструмент самопознания на основе схема-терапии: трекер потребностей, дневники схем и режимов, тесты, практики и пространство для работы с терапевтом.',
        '',
        '<b>Об авторе</b>',
        'Канал о схема-терапии — @SchemeHappens',
        'Записаться на сессию — @kotlarewski',
        '',
        'Приложение бесплатное 💛 Поддержать проект можно донатом ниже.',
      ].join('\n');
      try {
        await ctx.reply(text, {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '💛 Поддержать проект', url: DONATE_URL }],
            ],
          },
        });
      } catch (err) {
        // If the donate button URL is rejected, still show the info (with a
        // plain-text donate link) rather than a bare error.
        this.logger.error('about command failed', err);
        await ctx
          .reply(`${text}\n\n💛 ${DONATE_URL}`, { parse_mode: 'HTML' })
          .catch(() => null);
      }
    });

    // Декоративные вызовы Telegram API (меню команд, кнопка мини-аппа).
    // На свежем контейнере сеть может подняться позже процесса — ретраим с
    // бэкоффом и НЕ будим админа error-алертом: бот полноценно работает и
    // без них (инцидент 2026-07-12: «🚨 setMyCommands failed» на деплое).
    // fire-and-forget — не задерживаем launch().
    void retryWithBackoff(() =>
      this.bot!.telegram.setMyCommands([
        { command: 'start', description: 'Открыть «Всё по схеме»' },
        { command: 'settings', description: 'Настройки уведомлений' },
        { command: 'donate', description: 'Поддержать проект 💛' },
        { command: 'about', description: 'О приложении и авторе' },
      ]),
    ).then((ok) => {
      if (!ok) this.logger.warn('setMyCommands failed after retries');
    });

    void retryWithBackoff(() =>
      this.bot!.telegram.callApi('setChatMenuButton' as any, {
        menu_button: {
          type: 'web_app',
          text: 'Всё по схеме',
          web_app: { url: MINIAPP_URL },
        },
      }),
    ).then((ok) => {
      if (!ok) this.logger.warn('setChatMenuButton failed after retries');
    });

    this.launchBotWithRetry();
    const adminId = process.env.ADMIN_ID;
    if (adminId) {
      this.bot.telegram
        .sendMessage(adminId, '🚀 Деплой завершён')
        .catch(() => null);
    }

    // One-time cleanup: cancel legacy pre_reminder notifications left in queue
    this.botService
      .cancelAllPreReminders()
      .then((n) => {
        if (n > 0)
          this.logger.log(`Cancelled ${n} legacy pre_reminder notifications`);
      })
      .catch(() => null);
  }

  /** Отправить сообщение администратору. Возвращает true, если доставлено. */
  async notifyAdmin(text: string): Promise<boolean> {
    const adminId = process.env.ADMIN_ID;
    if (!adminId || !this.bot) return false;
    try {
      await this.bot.telegram.sendMessage(adminId, text, {
        parse_mode: 'HTML',
      });
      return true;
    } catch (err) {
      this.logger.error('notifyAdmin failed', err);
      return false;
    }
  }

  /**
   * Если юзер пришёл по pair-инвайту и только что принял согласие —
   * возобновляем подключение пары. true = флоу завершён (сообщение показано).
   * Общий для accept:(ty|vy) и легаси accept_consent.
   */
  private async resumePendingPair(ctx: any, rawId: number): Promise<boolean> {
    const pending = this.pendingPairCodes.get(rawId);
    if (!pending || pending.expiresAt <= Date.now()) return false;
    this.pendingPairCodes.delete(rawId);
    const ok = await this.pairsService.joinPair(BigInt(rawId), pending.code);
    const text = ok
      ? 'Вы в паре! 🤝 Теперь будете видеть индекс дня друг друга.'
      : 'Ссылка недействительна или уже использована.';
    const kb = Markup.inlineKeyboard([
      [Markup.button.webApp('🧠 Открыть Схему', MINIAPP_URL)],
    ]);
    try {
      await ctx.editMessageText(text, kb);
    } catch {
      await ctx.reply(text, kb);
    }
    return true;
  }

  /**
   * Запуск long-polling с ретраем. `bot.launch()` внутри дёргает `getMe()`;
   * если сеть на старте контейнера ещё не поднялась (Amvera → Telegram
   * ETIMEDOUT), launch() реджектится, и БЕЗ ретрая поллинг НИКОГДА не стартует
   * — бот висит «живым» (Nest поднят, уведомления-`sendMessage` идут), но не
   * отвечает на команды до следующего рестарта (инцидент 2026-07-16).
   *
   * 409 / «terminated by other» = поллит другой инстанс, ретрай навредит.
   * `stopping` = штатная остановка, ретрай не нужен. Промис launch() на успехе
   * резолвится лишь при остановке поллинга — поэтому только .catch, без await.
   */
  private launchBotWithRetry(attempt = 1): void {
    const MAX_ATTEMPTS = 5;
    if (attempt === 1) this.logger.log('Bot launch initiated');
    this.bot!.launch({ dropPendingUpdates: true }).catch((err) => {
      const msg = String(err);
      if (
        msg.includes('409') ||
        msg.includes('terminated by other') ||
        this.stopping
      ) {
        return;
      }
      if (attempt < MAX_ATTEMPTS) {
        const delayMs = attempt * 5_000;
        this.logger.warn(
          `Bot launch failed (попытка ${attempt}/${MAX_ATTEMPTS}), ` +
            `ретрай через ${delayMs}ms: ${msg}`,
        );
        setTimeout(() => {
          if (!this.stopping) this.launchBotWithRetry(attempt + 1);
        }, delayMs);
      } else {
        this.logger.error(
          `Bot launch провалился после ${MAX_ATTEMPTS} попыток — ` +
            `поллинг не стартовал`,
          err,
        );
      }
    });
  }

  async onModuleDestroy() {
    this.stopping = true;
    try {
      await this.bot?.stop();
    } catch {
      /* expected on graceful shutdown */
    }
  }
}

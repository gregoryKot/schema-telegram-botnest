import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Inject,
  Optional,
  Logger,
} from '@nestjs/common';
import { Telegraf, Context } from 'telegraf';
import { TELEGRAF_BOT, MINIAPP_URL, DONATE_URL } from './telegram.constants';
import { BOT_COMMANDS, ERROR_RETRY } from './telegram.constants';
import { BotService } from '../bot/bot.service';
import { BotAnalyticsService } from '../bot/bot.analytics.service';
import { AccountService } from '../bot/account.service';
import { PairsService } from '../bot/pairs.service';
import { PracticesService } from '../bot/practices.service';
import { NotificationService } from '../notification/notification.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { parseSourceSlug } from './start-source';
import { readStartPayload } from './start-payload';
import {
  buildAddressKeyboard,
  buildConsentKeyboard,
  buildWelcomeKeyboard,
} from './telegram.keyboards';
// Ре-экспорт: telegram.notify-actions.service импортирует клавиатуру отсюда.
export { buildWelcomeKeyboard };
import { isLoginPayload } from './login-payload';
import { TelegramLoginService } from './telegram.login.service';
import {
  isQuietHours,
  nextQuietEnd,
  tzOffsetAt,
} from '../notification/notification.time';
import { retryWithBackoff } from '../utils/retry';
import { t, AddressForm } from '../notification/address-form';
import {
  MINIAPP_ONLY_KEYBOARD,
  pairJoinResultText,
  acceptRetryText,
  resolveForm,
} from './telegram.reply-helpers';

export const WELCOME_TEXT = `Привет!

Бывает, что день прошёл нормально — а внутри что-то не так. Или наоборот, всё объективно сложно, но ощущение живое и устойчивое.

Дело почти всегда в потребностях. «Всё по схеме» помогает это увидеть — трекер, дневники схема-терапии и тест на схемы в одном месте.`;

const CONSENT_TEXT = `🔐 Соглашение об обработке данных

Прежде чем начать:

• Данные (оценки, дневники, планы) хранятся на защищённом сервере в зашифрованном виде и привязаны к Telegram ID
• Записи и ответы на опросники могут касаться психоэмоционального состояния — на обработку таких сведений тоже нужно отдельное согласие (даётся той же кнопкой ниже)
• Данные не передаются третьим лицам — кроме терапевта при подключении по коду и технической инфраструктуры (подробнее: schemehappens.ru/privacy)
• Всё можно удалить в любой момент через Настройки → Удалить данные
• Приложение не медицинский инструмент и не заменяет психотерапию
• Сервис предназначен для пользователей старше 18 лет

Кнопка ниже — это согласие с условиями, подтверждение 18+ и выбор формы обращения (поменять можно в любой момент в /settings).`;

const ADDRESS_PROMPT =
  'Один вопрос, чтобы дальше было комфортно: как удобнее общаться?';

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
    private readonly analyticsEvents: AnalyticsService,
    private readonly loginService: TelegramLoginService,
  ) {}

  private stopping = false;
  // Pending pair codes for users who need to accept consent first (in-memory, 15 min TTL)
  private readonly pendingPairCodes = new Map<
    number,
    { code: string; expiresAt: number }
  >();

  onModuleInit() {
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
        await ctx
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
        const payload = readStartPayload(ctx);
        // Атрибуция посева (src_<slug>) — ровно один раз, при первом
        // касании нового юзера, ДО гейта согласия (чтобы видеть и конверсию
        // «переход → принял соглашение»). Возвращающийся по той же ссылке
        // повторно не считается — isReturning уже вычислен выше.
        const sourceSlug = parseSourceSlug(payload);
        if (sourceSlug && !isReturning) {
          void this.analyticsEvents.track(userId, 'signup_source', {
            src: sourceSlug,
          });
        }
        // Вход по диплинку из приложения. Раньше гейта согласия: человек уже
        // соглашался при первом входе, а тут он ждёт подтверждения на другом
        // экране — упереться здесь в стену согласия значило бы подвесить его.
        if (isLoginPayload(payload)) {
          await this.loginService.handleStart(ctx, payload!, rawId);
          return;
        }
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
          const pairForm = await resolveForm(this.botService, ctx.from?.id);
          await ctx.reply(
            pairJoinResultText(ok, pairForm),
            MINIAPP_ONLY_KEYBOARD,
          );
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
            'Что-то пошло не так. Кнопка ниже откроет «Всё по схеме» ещё раз.',
            MINIAPP_ONLY_KEYBOARD,
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
      try {
        const form = await resolveForm(this.botService, ctx.from?.id);
        const text =
          '💛 <b>Поддержать SchemeHappens</b>\n\n' +
          t(
            form,
            'Приложение бесплатное и без рекламы. Если оно тебе помогает — поддержи проект любой суммой. Спасибо 🙏',
            'Приложение бесплатное и без рекламы. Если оно вам помогает — поддержите проект любой суммой. Спасибо 🙏',
          );
        await ctx.reply(text, {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '💛 Поддержать проект', url: DONATE_URL }],
            ],
          },
        });
      } catch (err) {
        // If the inline button is rejected (e.g. an invalid URL), still give
        // a working plain-text link instead of failing silently.
        this.logger.error('donate command failed', err);
        await ctx
          .reply(`💛 <b>Поддержать SchemeHappens</b>\n\n${DONATE_URL}`, {
            parse_mode: 'HTML',
          })
          .catch(() => null);
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
        // ctx.match не привязан к try — форма из callback_data доступна и тут.
        const form = (ctx.match as RegExpMatchArray | undefined)?.[1] as
          AddressForm | undefined;
        await ctx.editMessageText(acceptRetryText(form)).catch(() => null);
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
        // Форма ещё не выбрана на этом шаге — «ты» по умолчанию, как весь флоу до выбора.
        await ctx.editMessageText(acceptRetryText()).catch(() => null);
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
        await ctx.editMessageText(ERROR_RETRY).catch(() => null);
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
        await ctx.editMessageText(ERROR_RETRY).catch(() => null);
      }
    });

    this.bot.command('therapist', async (ctx) => {
      // DEPRECATED: was `/therapist <THERAPIST_CODE>` — bypassed the new
      // admin-approval flow. Redirect users to the mini-app form.
      try {
        const form = await resolveForm(this.botService, ctx.from?.id);
        await ctx.reply(
          t(
            form,
            '🩺 Заявка на роль психолога теперь подаётся через настройки приложения:\n' +
              'Открой мини-апп → Настройки → "Я психолог" → заполни форму.\n' +
              'Админ проверит и одобрит.',
            '🩺 Заявка на роль психолога теперь подаётся через настройки приложения:\n' +
              'Откройте мини-апп → Настройки → "Я психолог" → заполните форму.\n' +
              'Админ проверит и одобрит.',
          ),
        );
      } catch (err) {
        this.logger.error('therapist command failed', err);
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
      this.bot!.telegram.setMyCommands(BOT_COMMANDS),
    ).then((ok) => {
      if (!ok) this.logger.warn('setMyCommands failed after retries');
    });

    void retryWithBackoff(() =>
      this.bot!.telegram.callApi('setChatMenuButton', {
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
        .catch((err) => this.logger.error('deploy DM failed', err));
    }

    // One-time cleanup: cancel legacy pre_reminder notifications left in queue
    this.botService
      .cancelAllPreReminders()
      .then((n) => {
        if (n > 0)
          this.logger.log(`Cancelled ${n} legacy pre_reminder notifications`);
      })
      .catch((e) => this.logger.error('cancelAllPreReminders failed', e));
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
  private async resumePendingPair(
    ctx: Context,
    rawId: number,
  ): Promise<boolean> {
    const pending = this.pendingPairCodes.get(rawId);
    if (!pending || pending.expiresAt <= Date.now()) return false;
    this.pendingPairCodes.delete(rawId);
    const ok = await this.pairsService.joinPair(BigInt(rawId), pending.code);
    const text = pairJoinResultText(
      ok,
      await resolveForm(this.botService, rawId),
    );
    const kb = MINIAPP_ONLY_KEYBOARD;
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

  onModuleDestroy() {
    this.stopping = true;
    try {
      this.bot?.stop();
    } catch {
      /* expected on graceful shutdown */
    }
  }
}

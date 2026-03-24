import { Injectable, OnModuleInit, OnModuleDestroy, Inject, Optional, Logger } from '@nestjs/common';
import { Telegraf, Context, Markup } from 'telegraf';
import { TELEGRAF_BOT, CHANNEL, BOOKING_URL, MINIAPP_URL } from './telegram.constants';
import { BotService } from '../bot/bot.service';
import { BotAnalyticsService } from '../bot/bot.analytics.service';
import { NotificationService } from '../notification/notification.service';
import { buildSummaryText } from '../notification/notification.templates';

const WELCOME_TEXT = `Привет!

Бывает, что день прошёл нормально — а внутри что-то не так. Или наоборот, всё объективно сложно, но ощущение живое и устойчивое.

Дело почти всегда в потребностях. Дневник помогает это увидеть — раз в день, пять шкал, и через несколько дней паттерн становится различимым.`;

export function buildWelcomeKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.webApp('📱 Открыть дневник', MINIAPP_URL)],
    [Markup.button.callback('🔍 Как это работает', 'howto')],
    [Markup.button.callback('📖 Подробнее', 'faq'), Markup.button.callback('👤 Обо мне', 'about')],
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
  ) {}

  private stopping = false;

  async onModuleInit() {
    if (!this.bot) {
      this.logger.warn('BOT_TOKEN not provided — bot will not start.');
      return;
    }

    this.bot.command('start', async (ctx) => {
      try {
        const userId = ctx.from?.id;
        if (userId) await this.botService.registerUser(userId);
        const payload = (ctx as any).startPayload as string | undefined;
        if (payload?.startsWith('pair_') && userId) {
          const code = payload.slice(5).toUpperCase();
          const ok = await this.botService.joinPair(userId, code);
          if (ok) {
            await ctx.reply('Вы в паре! 🤝 Теперь будете видеть индекс дня друг друга.',
              Markup.inlineKeyboard([[Markup.button.webApp('📱 Открыть дневник', MINIAPP_URL)]]));
          } else {
            await ctx.reply('Ссылка недействительна или уже использована.',
              Markup.inlineKeyboard([[Markup.button.webApp('📱 Открыть дневник', MINIAPP_URL)]]));
          }
          return;
        }
        await ctx.reply(WELCOME_TEXT, buildWelcomeKeyboard());
      } catch (err) {
        this.logger.error('start command failed', err);
        await ctx.reply('Что-то пошло не так. Попробуй открыть дневник через кнопку ниже.',
          Markup.inlineKeyboard([[Markup.button.webApp('📱 Открыть дневник', MINIAPP_URL)]])).catch(() => null);
      }
    });

    this.bot.command('chart', async (ctx) => {
      try {
        const userId = ctx.from?.id;
        if (!userId) return;
        const ratings = await this.botService.getRatings(userId);
        await ctx.reply(buildSummaryText(this.botService.getNeeds(), ratings));
      } catch (err) {
        this.logger.error('chart command failed', err);
        await ctx.reply('Что-то пошло не так. Попробуй открыть дневник через кнопку ниже.',
          Markup.inlineKeyboard([[Markup.button.webApp('📱 Открыть дневник', MINIAPP_URL)]])).catch(() => null);
      }
    });

    this.bot.command('ping', async (ctx) => {
      try {
        await ctx.reply('OK');
      } catch (err) {
        this.logger.error('ping command failed', err);
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

    this.bot.command('post', async (ctx) => {
      try {
        const adminId = Number(process.env.ADMIN_ID);
        if (!adminId || ctx.from?.id !== adminId) {
          await ctx.reply('⛔ Нет доступа');
          return;
        }
        await this.bot!.telegram.sendMessage(CHANNEL, '📅 Запись на сессию — прямо по кнопке', {
          reply_markup: Markup.inlineKeyboard([Markup.button.url('📝 Записаться', BOOKING_URL)]).reply_markup,
        });
        await ctx.reply('✅ Пост отправлен в канал');
      } catch (err) {
        this.logger.error('post command failed', err);
        await ctx.reply('❌ Не удалось отправить пост. Убедись, что бот — админ канала.').catch(() => null);
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

    this.bot.action('snooze_reminder', async (ctx) => {
      try {
        await ctx.answerCbQuery('⏰ Напомню через час');
        const userId = ctx.from?.id;
        if (userId) {
          const settings = await this.botService.getUserSettings(userId);
          const tzOffset = settings?.notifyTzOffset ?? 2;
          let sendAt = new Date(Date.now() + 3_600_000);
          // Quiet hours: if local hour >= 22, push to 8:00 next morning
          const localHour = ((sendAt.getUTCHours() + tzOffset) % 24 + 24) % 24;
          if (localHour >= 22 || localHour < 7) {
            sendAt = new Date();
            sendAt.setUTCHours(((8 - tzOffset) % 24 + 24) % 24, 0, 0, 0);
            if (sendAt <= new Date()) sendAt.setUTCDate(sendAt.getUTCDate() + 1);
          }
          await this.notificationService.cancel(userId, 'reminder');
          await this.notificationService.schedule(userId, 'pre_reminder', sendAt);
        }
        await ctx.editMessageReplyMarkup(undefined).catch(() => null);
      } catch (err) {
        this.logger.error('snooze_reminder action failed', err);
      }
    });

    await this.bot.telegram.setMyCommands([
      { command: 'start', description: 'Главное меню' },
      { command: 'chart', description: 'Сводка за сегодня' },
      { command: 'history', description: 'История за 7 дней' },
      { command: 'settings', description: 'Настройки уведомлений' },
    ]).catch((err) => this.logger.error('setMyCommands failed', err));

    await this.bot.telegram.callApi('setChatMenuButton' as any, {
      menu_button: { type: 'web_app', text: 'Дневник', web_app: { url: MINIAPP_URL } },
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

  async onModuleDestroy() {
    this.stopping = true;
    try {
      await this.bot?.stop();
    } catch { /* expected on graceful shutdown */ }
  }
}

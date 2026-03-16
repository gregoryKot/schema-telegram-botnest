import { Injectable, OnModuleInit, OnModuleDestroy, Inject, Optional, Logger } from '@nestjs/common';
import { Telegraf, Context, Markup } from 'telegraf';
import { TELEGRAF_BOT, CHANNEL, BOOKING_URL, MINIAPP_URL } from './telegram.constants';
import { BotService } from '../bot/bot.service';
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
  ) {}

  async onModuleInit() {
    if (!this.bot) {
      this.logger.warn('BOT_TOKEN not provided — bot will not start.');
      return;
    }

    this.bot.command('start', async (ctx) => {
      try {
        if (ctx.from?.id) await this.botService.registerUser(ctx.from.id);
        await ctx.reply(WELCOME_TEXT, buildWelcomeKeyboard());
      } catch (err) {
        this.logger.error('start command failed', err);
        await ctx.reply('Что-то пошло не так. Попробуй ещё раз — /start').catch(() => null);
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
        await ctx.reply('❌ Не удалось получить данные').catch(() => null);
      }
    });

    this.bot.command('ping', async (ctx) => {
      try {
        await ctx.reply('OK');
      } catch (err) {
        this.logger.error('ping command failed', err);
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

    await this.bot.telegram.setMyCommands([
      { command: 'start', description: 'Главное меню' },
      { command: 'chart', description: 'Сводка за сегодня' },
      { command: 'history', description: 'История за 7 дней' },
      { command: 'settings', description: 'Настройки уведомлений' },
    ]).catch((err) => this.logger.error('setMyCommands failed', err));

    await this.bot.telegram.callApi('setChatMenuButton' as any, {
      menu_button: { type: 'web_app', text: 'Дневник', web_app: { url: MINIAPP_URL } },
    }).catch((err: unknown) => this.logger.error('setChatMenuButton failed', err));

    this.bot.launch({ dropPendingUpdates: true }).catch((err) => {
      this.logger.error('Failed to launch bot', err);
    });
    this.logger.log('Bot launched');
  }

  async onModuleDestroy() {
    try {
      await this.bot?.stop();
      this.logger.log('Bot stopped');
    } catch (err) {
      this.logger.error('Error stopping bot', err);
    }
  }
}

import { Injectable, OnModuleInit, OnModuleDestroy, Inject, Optional, Logger } from '@nestjs/common';
import { Telegraf, Context, Markup } from 'telegraf';
import { TELEGRAF_BOT, CHANNEL, BOOKING_URL } from './telegram.constants';
import { BotService, NeedId, NEED_IDS } from '../bot/bot.service';
import { FAQ, FAQ_MENU_TEXT } from './faq';
import { buildSummaryText } from './telegram.schedule.service';

const WELCOME_TEXT = `Привет!

У каждого из нас есть 5 базовых групп эмоциональных потребностей. Когда они удовлетворены — нам хорошо. Когда нет — появляются тревога, усталость, раздражение.

Раз в день отмечай, насколько каждая потребность закрыта по шкале 0–10. Это помогает замечать паттерны и лучше понимать своё состояние.`;

@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramService.name);

  constructor(
    @Inject(TELEGRAF_BOT) @Optional() private readonly bot: Telegraf<Context> | null,
    private readonly botService: BotService,
  ) {}

  private async editOrReply(ctx: Context, text: string, extra?: Parameters<Context['reply']>[1]) {
    try {
      await ctx.editMessageText(text, extra as any);
    } catch {
      await ctx.reply(text, extra);
    }
  }

  private buildWelcomeKeyboard() {
    return Markup.inlineKeyboard([
      [Markup.button.callback('✏️ Заполнить', 'back:needs')],
      [Markup.button.callback('📖 Подробнее', 'faq'), Markup.button.callback('👤 Обо мне', 'about')],
      [Markup.button.webApp('📱 Открыть дневник', 'https://schema-miniapp.vercel.app')],
    ]);
  }

  private buildFaqKeyboard() {
    const needs = this.botService.getNeeds();
    const needButtons = needs.map((n) => Markup.button.callback(n.title, `faq:${n.id}`));
    return Markup.inlineKeyboard([
      [Markup.button.callback('🧠 Схематерапия', 'faq:therapy')],
      needButtons.slice(0, 2),
      needButtons.slice(2, 4),
      needButtons.slice(4),
      [Markup.button.callback('⬅️ Назад', 'back:welcome')],
    ]);
  }

  async onModuleInit() {
    if (!this.bot) {
      this.logger.warn('BOT_TOKEN not provided — bot will not start.');
      return;
    }

    this.bot.command('start', async (ctx) => {
      try {
        if (ctx.from?.id) await this.botService.registerUser(ctx.from.id);
        await ctx.reply(WELCOME_TEXT, this.buildWelcomeKeyboard());
      } catch (err) {
        this.logger.error('start command failed', err);
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
        await ctx.reply('❌ Не удалось отправить пост. Убедись что бот — админ канала.').catch(() => null);
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
        await this.editOrReply(ctx, WELCOME_TEXT, this.buildWelcomeKeyboard());
      } catch (err) {
        this.logger.error('back:welcome action failed', err);
      }
    });

    this.bot.action('about', async (ctx) => {
      try {
        await ctx.answerCbQuery();
        await this.editOrReply(ctx, FAQ['about'], Markup.inlineKeyboard([
          [Markup.button.url('📝 Записаться на сессию', BOOKING_URL)],
          [Markup.button.callback('⬅️ Назад', 'back:welcome')],
        ]));
      } catch (err) {
        this.logger.error('about action failed', err);
      }
    });

    this.bot.action('faq', async (ctx) => {
      try {
        await ctx.answerCbQuery();
        await this.editOrReply(ctx, FAQ_MENU_TEXT, this.buildFaqKeyboard());
      } catch (err) {
        this.logger.error('faq action failed', err);
      }
    });

    this.bot.action(/^faq:([a-z_]+)$/, async (ctx) => {
      try {
        const topic = (ctx.match as RegExpMatchArray)[1];
        const text = FAQ[topic];
        if (!text) {
          await ctx.answerCbQuery('Раздел не найден', { show_alert: true });
          return;
        }
        await ctx.answerCbQuery();
        let keyboard: ReturnType<typeof Markup.inlineKeyboard>;
        if (topic.startsWith('tips_')) {
          const needId = topic.slice(5);
          keyboard = Markup.inlineKeyboard([[Markup.button.callback('⬅️ Назад', `faq:${needId}`)]]);
        } else if (NEED_IDS.includes(topic as NeedId)) {
          keyboard = Markup.inlineKeyboard([
            [Markup.button.callback('💡 Что помогает?', `faq:tips_${topic}`)],
            [Markup.button.callback('⬅️ Назад', 'faq')],
          ]);
        } else {
          keyboard = Markup.inlineKeyboard([[Markup.button.callback('⬅️ Назад', 'faq')]]);
        }
        await this.editOrReply(ctx, text, keyboard);
      } catch (err) {
        this.logger.error('faq topic action failed', err);
        await ctx.answerCbQuery('Что-то пошло не так').catch(() => null);
      }
    });

    await this.bot.telegram.setMyCommands([
      { command: 'start', description: 'Главное меню' },
      { command: 'chart', description: 'Сводка за сегодня' },
      { command: 'history', description: 'История за 7 дней' },
      { command: 'settings', description: 'Настройки уведомлений' },
    ]).catch((err) => this.logger.error('setMyCommands failed', err));

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

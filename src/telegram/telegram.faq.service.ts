import { Injectable, OnModuleInit, Inject, Optional, Logger } from '@nestjs/common';
import { Telegraf, Context, Markup } from 'telegraf';
import { TELEGRAF_BOT, BOOKING_URL } from './telegram.constants';
import { BotService, NeedId, NEED_IDS } from '../bot/bot.service';
import { FAQ, FAQ_MENU_TEXT } from './faq';

async function editOrReply(ctx: Context, text: string, extra?: Parameters<Context['reply']>[1]) {
  try {
    await ctx.editMessageText(text, extra as any);
  } catch {
    await ctx.reply(text, extra);
  }
}

@Injectable()
export class TelegramFaqService implements OnModuleInit {
  private readonly logger = new Logger(TelegramFaqService.name);

  constructor(
    @Inject(TELEGRAF_BOT) @Optional() private readonly bot: Telegraf<Context> | null,
    private readonly botService: BotService,
  ) {}

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
    if (!this.bot) return;

    this.bot.action('about', async (ctx) => {
      try {
        await ctx.answerCbQuery();
        await editOrReply(ctx, FAQ['about'], Markup.inlineKeyboard([
          [Markup.button.url('📝 Записаться на сессию', BOOKING_URL)],
          [Markup.button.url('📣 Канал @SchemeHappens', 'https://t.me/SchemeHappens')],
          [Markup.button.url('💬 Написать мне', 'https://t.me/kotlarewski')],
          [Markup.button.callback('⬅️ Назад', 'back:welcome')],
        ]));
      } catch (err) {
        this.logger.error('about action failed', err);
        await ctx.answerCbQuery().catch(() => null);
      }
    });

    this.bot.action('howto', async (ctx) => {
      try {
        await ctx.answerCbQuery();
        await editOrReply(ctx, FAQ['howto'], Markup.inlineKeyboard([
          [Markup.button.callback('⬅️ Назад', 'back:welcome')],
        ]));
      } catch (err) {
        this.logger.error('howto action failed', err);
        await ctx.answerCbQuery().catch(() => null);
      }
    });

    this.bot.action('faq', async (ctx) => {
      try {
        await ctx.answerCbQuery();
        await editOrReply(ctx, FAQ_MENU_TEXT, this.buildFaqKeyboard());
      } catch (err) {
        this.logger.error('faq action failed', err);
        await ctx.answerCbQuery().catch(() => null);
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
        await editOrReply(ctx, text, keyboard);
      } catch (err) {
        this.logger.error('faq topic action failed', err);
        await ctx.answerCbQuery('Что-то пошло не так').catch(() => null);
      }
    });
  }
}

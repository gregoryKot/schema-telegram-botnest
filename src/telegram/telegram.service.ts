import { Injectable, OnModuleInit, OnModuleDestroy, Inject, Optional, Logger } from '@nestjs/common';
import { Telegraf, Context, Markup } from 'telegraf';
import { TELEGRAF_BOT } from './telegram.constants';
import { BotService, NeedId, NEED_IDS } from '../bot/bot.service';
import { ChartService } from '../chart/chart.service';
import { FAQ, FAQ_MENU_TEXT } from './faq';

const CHANNEL = '@SchemeHappens';
const BOOKING_URL = 'https://cal.com/kotlarewski';
const WELCOME_TEXT = `Привет!

У каждого из нас есть 5 базовых групп эмоциональных потребностей. Когда они удовлетворены — нам хорошо. Когда нет — появляются тревога, усталость, раздражение.

Раз в день отмечай, насколько каждая потребность закрыта по шкале 0–10. Это помогает замечать паттерны и лучше понимать своё состояние.`;

@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramService.name);

  constructor(
    @Inject(TELEGRAF_BOT) @Optional() private readonly bot: Telegraf<Context> | null,
    private readonly botService: BotService,
    private readonly chartService: ChartService,
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
      [Markup.button.callback('📖 Подробнее', 'faq')],
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

  private async buildNeedsKeyboard(userId: number) {
    const needs = this.botService.getNeeds();
    const ratings = await this.botService.getRatings(userId);
    const buttons = needs.map((n) => {
      const value = ratings[n.id];
      const label = value !== undefined ? `✅ ${n.title} · ${value}` : n.title;
      return Markup.button.callback(label, `need:${n.id}`);
    });
    const rows: ReturnType<typeof Markup.button.callback>[][] = [];
    for (let i = 0; i < buttons.length; i += 2) {
      rows.push(buttons.slice(i, i + 2));
    }
    rows.push([Markup.button.callback('❌ Отмена', 'cancel')]);
    return Markup.inlineKeyboard(rows);
  }

  private buildRatingKeyboard(needId: NeedId) {
    const row1 = [0, 1, 2, 3, 4, 5].map((v) => Markup.button.callback(String(v), `rate:${needId}:${v}`));
    const row2 = [6, 7, 8, 9, 10].map((v) => Markup.button.callback(String(v), `rate:${needId}:${v}`));
    return Markup.inlineKeyboard([row1, row2, [Markup.button.callback('⬅️ Назад', 'back:needs')]]);
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
        const buffer = await this.chartService.generateRadarChart(this.botService.getNeeds(), ratings);
        await ctx.replyWithPhoto({ source: buffer }, { caption: '📊 Твоё колесо потребностей за сегодня' });
      } catch (err) {
        this.logger.error('chart command failed', err);
        await ctx.reply('❌ Не удалось сгенерировать диаграмму').catch(() => null);
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
        await this.editOrReply(ctx, text, Markup.inlineKeyboard([[Markup.button.callback('⬅️ Назад', 'faq')]]));
      } catch (err) {
        this.logger.error('faq topic action failed', err);
        await ctx.answerCbQuery('Что-то пошло не так').catch(() => null);
      }
    });

    this.bot.action('show:chart', async (ctx) => {
      try {
        const userId = ctx.from?.id;
        await ctx.answerCbQuery();
        if (!userId) return;
        const ratings = await this.botService.getRatings(userId);
        const buffer = await this.chartService.generateRadarChart(this.botService.getNeeds(), ratings);
        await ctx.replyWithPhoto({ source: buffer }, { caption: '📊 Твоё колесо потребностей за сегодня' });
      } catch (err) {
        this.logger.error('show:chart action failed', err);
        await ctx.reply('❌ Не удалось сгенерировать диаграмму').catch(() => null);
      }
    });

    this.bot.action('back:needs', async (ctx) => {
      try {
        await ctx.answerCbQuery();
        const userId = ctx.from?.id;
        if (!userId) return;
        await this.editOrReply(ctx, 'Выберите потребность:', await this.buildNeedsKeyboard(userId));
      } catch (err) {
        this.logger.error('back:needs action failed', err);
      }
    });

    this.bot.action(/^need:([a-z_]+)$/, async (ctx) => {
      try {
        const needId = (ctx.match as RegExpMatchArray)[1];
        if (!NEED_IDS.includes(needId as NeedId)) {
          await ctx.answerCbQuery('Неизвестная потребность', { show_alert: true });
          return;
        }
        const need = this.botService.getNeeds().find((n) => n.id === needId)!;
        await ctx.answerCbQuery();
        await this.editOrReply(ctx, `Оцените: ${need.fullTitle}`, this.buildRatingKeyboard(needId as NeedId));
      } catch (err) {
        this.logger.error('need action failed', err);
        await ctx.answerCbQuery('Что-то пошло не так').catch(() => null);
      }
    });

    this.bot.action(/^rate:([a-z_]+):(\d{1,2})$/, async (ctx) => {
      const match = ctx.match as RegExpMatchArray;
      const needId = match[1];
      const raw = Number(match[2]);

      if (!NEED_IDS.includes(needId as NeedId) || !Number.isInteger(raw) || raw < 0 || raw > 10) {
        await ctx.answerCbQuery('Неверные данные', { show_alert: true }).catch(() => null);
        return;
      }
      const userId = ctx.from?.id;
      if (!userId) {
        await ctx.answerCbQuery('Не удалось определить пользователя', { show_alert: true }).catch(() => null);
        return;
      }

      try {
        await ctx.answerCbQuery();
        await this.botService.saveRating(userId, needId as NeedId, raw);
        const need = this.botService.getNeeds().find((n) => n.id === needId)!;
        await this.editOrReply(
          ctx,
          `✅ Записал: ${need.fullTitle} — ${raw}/10`,
          Markup.inlineKeyboard([
            [Markup.button.callback('✏️ Продолжить', 'back:needs')],
            [Markup.button.callback('📊 Диаграмма', 'show:chart')],
          ]),
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`rate action failed [needId=${needId} value=${raw} userId=${userId}]: ${message}`);
        await ctx.reply('❌ Ошибка сохранения, попробуй ещё раз').catch(() => null);
      }
    });

    try {
      await this.bot.launch();
      this.logger.log('Bot launched');
    } catch (err) {
      this.logger.error('Failed to launch bot', err);
      throw err;
    }
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

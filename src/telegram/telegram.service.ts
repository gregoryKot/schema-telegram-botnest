import { Injectable, OnModuleInit, OnModuleDestroy, Inject, Optional, Logger } from '@nestjs/common';
import { Telegraf, Context, Markup } from 'telegraf';
import { TELEGRAF_BOT } from './telegram.constants';
import { BotService, NeedId, NEED_IDS } from '../bot/bot.service';

const CHANNEL = '@SchemeHappens';
const BOOKING_URL = 'https://cal.com/kotlarewski';

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

  private buildNeedsKeyboard() {
    const needs = this.botService.getNeeds();
    const buttons = needs.map((n) => Markup.button.callback(n.title, `need:${n.id}`));
    const rows: ReturnType<typeof Markup.button.callback>[][] = [];
    for (let i = 0; i < buttons.length; i += 2) {
      rows.push(buttons.slice(i, i + 2));
    }
    rows.push([Markup.button.callback('❌ Отмена', 'back:needs')]);
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
        await ctx.reply(
          'Колесо потребностей',
          Markup.inlineKeyboard([Markup.button.callback('✏️ Отметить сейчас', 'back:needs')]),
        );
      } catch (err) {
        this.logger.error('start command failed', err);
      }
    });

    this.bot.command('ping', async (ctx) => {
      try {
        await ctx.reply('OK');
      } catch (err) {
        this.logger.error('ping command failed', err);
      }
    });

    // Admin-only: post signup button to channel
    this.bot.command('post', async (ctx) => {
      try {
        const adminId = Number(process.env.ADMIN_ID);
        if (!adminId || ctx.from?.id !== adminId) {
          await ctx.reply('⛔ Нет доступа');
          return;
        }
        await this.bot!.telegram.sendMessage(
          CHANNEL,
          '📅 Запись на сессию — прямо по кнопке',
          {
            reply_markup: Markup.inlineKeyboard([
              Markup.button.url('📝 Записаться', BOOKING_URL),
            ]).reply_markup,
          },
        );
        await ctx.reply('✅ Пост отправлен в канал');
      } catch (err) {
        this.logger.error('post command failed', err);
        await ctx.reply('❌ Не удалось отправить пост. Убедись что бот — админ канала.').catch(() => null);
      }
    });

    this.bot.action('back:needs', async (ctx) => {
      try {
        await ctx.answerCbQuery();
        await this.editOrReply(ctx, 'Выберите потребность:', this.buildNeedsKeyboard());
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
        await this.editOrReply(ctx, `Оцените: ${need.title}`, this.buildRatingKeyboard(needId as NeedId));
      } catch (err) {
        this.logger.error('need action failed', err);
        await ctx.answerCbQuery('Что-то пошло не так').catch(() => null);
      }
    });

    this.bot.action(/^rate:([a-z_]+):(\d{1,2})$/, async (ctx) => {
      const match = ctx.match as RegExpMatchArray;
      const needId = match[1];
      const raw = Number(match[2]);

      // Validate before touching DB
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
        await this.botService.saveRating(userId, needId as NeedId, raw);
        const need = this.botService.getNeeds().find((n) => n.id === needId)!;
        await ctx.answerCbQuery();
        await this.editOrReply(
          ctx,
          `✅ Записал: ${need.title} — ${raw}/10`,
          Markup.inlineKeyboard([Markup.button.callback('✏️ Ещё', 'back:needs')]),
        );
      } catch (err) {
        this.logger.error('rate action failed', err);
        await ctx.answerCbQuery('Ошибка сохранения, попробуй ещё раз', { show_alert: true }).catch(() => null);
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

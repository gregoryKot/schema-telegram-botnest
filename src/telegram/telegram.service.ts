import { Injectable, OnModuleInit, OnModuleDestroy, Inject, Optional, Logger } from '@nestjs/common';
import { Telegraf, Context, Markup } from 'telegraf';
import { TELEGRAF_BOT } from './telegram.constants';
import { BotService, NeedId } from '../bot/bot.service';

@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramService.name);

  constructor(
    @Inject(TELEGRAF_BOT) @Optional() private readonly bot: Telegraf<Context> | null,
    private readonly botService: BotService,
  ) {}

  private buildNeedsKeyboard() {
    const needs = this.botService.getNeeds();
    const buttons = needs.map((n) => Markup.button.callback(n.title, `need:${n.id}`));
    const chunked: any[] = [];
    for (let i = 0; i < buttons.length; i += 2) {
      chunked.push(buttons.slice(i, i + 2));
    }
    chunked.push([Markup.button.callback('❌ Отмена', 'back:needs')]);
    return Markup.inlineKeyboard(chunked as any);
  }

  private buildRatingKeyboard(needId: NeedId) {
    const row1 = [0,1,2,3,4,5].map((v) => Markup.button.callback(String(v), `rate:${needId}:${v}`));
    const row2 = [6,7,8,9,10].map((v) => Markup.button.callback(String(v), `rate:${needId}:${v}`));
    return Markup.inlineKeyboard([row1, row2, [Markup.button.callback('⬅️ Назад', 'back:needs')]] as any);
  }

  async onModuleInit() {
    if (!this.bot) {
      this.logger.warn('BOT_TOKEN not provided — Telegram bot will not be launched.');
      return;
    }

    this.bot.command('start', async (ctx) => {
      const keyboard = Markup.inlineKeyboard([Markup.button.callback('✏️ Отметить сейчас', 'back:needs')]);
      await ctx.reply('Колесо потребностей', keyboard as any);
    });

    this.bot.command('ping', async (ctx) => {
      await ctx.reply('OK');
    });

    // Post signup button to @SchemeHappens channel (admin only)
    this.bot.command('post', async (ctx) => {
      const adminId = Number(process.env.ADMIN_ID);
      if (!adminId || ctx.from?.id !== adminId) {
        await ctx.reply('⛔ Нет доступа');
        return;
      }
      await this.bot!.telegram.sendMessage(
        '@SchemeHappens',
        '📅 Запись на сессию — прямо по кнопке',
        {
          reply_markup: Markup.inlineKeyboard([
            Markup.button.url('📝 Записаться', 'https://cal.com/kotlarewski'),
          ]).reply_markup,
        },
      );
      await ctx.reply('✅ Пост отправлен в канал');
    });

    this.bot.action('back:needs', async (ctx) => {
      try {
        await ctx.answerCbQuery();
        await ctx.editMessageText('Выберите потребность:', this.buildNeedsKeyboard() as any);
      } catch (err) {
        this.logger.error('Error showing needs', err as Error);
      }
    });

    // \A and \z are not JS regex — use ^ and $
    this.bot.action(/^need:([a-z_]+)$/, async (ctx) => {
      try {
        const match = ctx.match as RegExpMatchArray;
        const needId = match[1] as NeedId;
        await ctx.answerCbQuery();
        const need = this.botService.getNeeds().find(n => n.id === needId);
        await ctx.editMessageText(
          `Оцените: ${need?.title ?? needId}`,
          this.buildRatingKeyboard(needId) as any,
        );
      } catch (err) {
        this.logger.error('Error handling need selection', err as Error);
      }
    });

    this.bot.action(/^rate:([a-z_]+):(\d{1,2})$/, async (ctx) => {
      try {
        const match = ctx.match as RegExpMatchArray;
        const needId = match[1] as NeedId;
        const raw = Number(match[2]);
        if (!Number.isInteger(raw) || raw < 0 || raw > 10) {
          await ctx.answerCbQuery('Неверный рейтинг', { show_alert: true });
          return;
        }
        const userId = ctx.from?.id;
        if (!userId) {
          await ctx.answerCbQuery('Не удалось определить пользователя', { show_alert: true });
          return;
        }
        await this.botService.saveRating(userId, needId, raw);

        const need = this.botService.getNeeds().find((n) => n.id === needId);
        await ctx.answerCbQuery();
        await ctx.editMessageText(
          `✅ Записал: ${need?.title ?? needId} — ${raw}/10`,
          Markup.inlineKeyboard([Markup.button.callback('✏️ Ещё', 'back:needs')]) as any,
        );
      } catch (err) {
        this.logger.error('Error handling rating', err as Error);
      }
    });

    try {
      await this.bot.launch();
      this.logger.log('Telegraf bot launched');
    } catch (err) {
      this.logger.error('Failed to launch Telegraf bot', err as Error);
      throw err;
    }
  }

  async onModuleDestroy() {
    if (!this.bot) return;
    try {
      await this.bot.stop();
      this.logger.log('Telegraf bot stopped');
    } catch (err) {
      this.logger.error('Error stopping Telegraf bot', err as Error);
    }
  }

  async handleUpdate(update: unknown) {
    return;
  }
}

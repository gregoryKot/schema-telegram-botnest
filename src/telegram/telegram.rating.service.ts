import { Injectable, OnModuleInit, Inject, Optional, Logger } from '@nestjs/common';
import { Telegraf, Context, Markup } from 'telegraf';
import { TELEGRAF_BOT } from './telegram.constants';
import { BotService, NeedId, NEED_IDS } from '../bot/bot.service';
import { buildSummaryText } from './telegram.schedule.service';

const SHORT_MONTHS = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];

function formatHistoryDate(dateStr: string): string {
  const [, m, d] = dateStr.split('-');
  return `${parseInt(d)} ${SHORT_MONTHS[parseInt(m) - 1]}`;
}

@Injectable()
export class TelegramRatingService implements OnModuleInit {
  private readonly logger = new Logger(TelegramRatingService.name);

  constructor(
    @Inject(TELEGRAF_BOT) @Optional() private readonly bot: Telegraf<Context> | null,
    private readonly botService: BotService,
  ) {}

  async buildNeedsKeyboard(userId: number) {
    const needs = this.botService.getNeeds();
    const ratings = await this.botService.getRatings(userId);
    const buttons = needs.map((n) => {
      const value = ratings[n.id];
      const label = value !== undefined ? `✅ ${n.title} · ${value}` : n.title;
      return Markup.button.callback(label, `need:${n.id}`);
    });
    const rows: ReturnType<typeof Markup.button.callback>[][] = [];
    for (let i = 0; i < buttons.length; i += 2) rows.push(buttons.slice(i, i + 2));
    rows.push([Markup.button.callback('❌ Отмена', 'cancel')]);
    return Markup.inlineKeyboard(rows);
  }

  private buildRatingKeyboard(needId: NeedId) {
    const row1 = [0,1,2,3,4,5].map((v) => Markup.button.callback(String(v), `rate:${needId}:${v}`));
    const row2 = [6,7,8,9,10].map((v) => Markup.button.callback(String(v), `rate:${needId}:${v}`));
    return Markup.inlineKeyboard([row1, row2, [Markup.button.callback('⬅️ Назад', 'back:needs')]]);
  }

  async onModuleInit() {
    if (!this.bot) return;

    this.bot.command('history', async (ctx) => {
      try {
        const userId = ctx.from?.id;
        if (!userId) return;
        const history = await this.botService.getHistoryRatings(userId, 7);
        if (history.length === 0) {
          await ctx.reply('Пока нет данных. Заполни дневник сегодня!');
          return;
        }
        const needs = this.botService.getNeeds();
        const lines = history.map(({ date, ratings }) => {
          const parts = needs.map((n) => `${n.emoji}${ratings[n.id] ?? '–'}`);
          return `${formatHistoryDate(date)}  ${parts.join('  ')}`;
        });
        await ctx.reply(`📔 История · последние 7 дней\n\n${lines.join('\n')}`);
      } catch (err) {
        this.logger.error('history command failed', err);
        await ctx.reply('❌ Не удалось получить историю').catch(() => null);
      }
    });

    this.bot.action('show:chart', async (ctx) => {
      try {
        const userId = ctx.from?.id;
        await ctx.answerCbQuery();
        if (!userId) return;
        const ratings = await this.botService.getRatings(userId);
        await ctx.reply(buildSummaryText(this.botService.getNeeds(), ratings));
      } catch (err) {
        this.logger.error('show:chart action failed', err);
        await ctx.reply('❌ Не удалось получить данные').catch(() => null);
      }
    });

    this.bot.action('back:needs', async (ctx) => {
      try {
        await ctx.answerCbQuery();
        const userId = ctx.from?.id;
        if (!userId) return;
        const keyboard = await this.buildNeedsKeyboard(userId);
        try {
          await ctx.editMessageText('Выберите потребность:', keyboard as any);
        } catch {
          await ctx.reply('Выберите потребность:', keyboard);
        }
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
        try {
          await ctx.editMessageText(`Оцените: ${need.fullTitle}`, this.buildRatingKeyboard(needId as NeedId) as any);
        } catch {
          await ctx.reply(`Оцените: ${need.fullTitle}`, this.buildRatingKeyboard(needId as NeedId));
        }
      } catch (err) {
        this.logger.error('need action failed', err);
        await ctx.answerCbQuery('Что-то пошло не так').catch(() => null);
      }
    });

    this.bot.action(/^rate:([a-z_]+):(\d{1,2})$/, async (ctx) => {
      try {
        const match = ctx.match as RegExpMatchArray;
        const needId = match[1];
        const raw = Number(match[2]);
        if (!NEED_IDS.includes(needId as NeedId) || !Number.isInteger(raw) || raw < 0 || raw > 10) {
          await ctx.answerCbQuery('Неверные данные', { show_alert: true }).catch(() => null);
          return;
        }
        const userId = ctx.from?.id;
        if (!userId) {
          await ctx.answerCbQuery().catch(() => null);
          return;
        }
        await ctx.answerCbQuery();
        await this.botService.saveRating(userId, needId as NeedId, raw);
        const need = this.botService.getNeeds().find((n) => n.id === needId)!;
        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('✏️ Продолжить', 'back:needs')],
          [Markup.button.callback('📊 Сводка', 'show:chart')],
        ]);
        try {
          await ctx.editMessageText(`✅ Записал: ${need.fullTitle} — ${raw}/10`, keyboard as any);
        } catch {
          await ctx.reply(`✅ Записал: ${need.fullTitle} — ${raw}/10`, keyboard);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`rate action failed: ${message}`);
        await ctx.reply('❌ Ошибка сохранения, попробуй ещё раз').catch(() => null);
      }
    });
  }
}

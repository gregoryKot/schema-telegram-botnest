import { Injectable, OnModuleInit, Inject, Optional, Logger } from '@nestjs/common';
import { Telegraf, Context, Markup } from 'telegraf';
import { TELEGRAF_BOT } from './telegram.constants';
import { BotService } from '../bot/bot.service';
import { TelegramScheduleService } from './telegram.schedule.service';
import { CADENCE_LABELS } from '../notification/notification.cadence.service';
import { buildSettingsView } from './telegram.settings.service';

/** Пресеты тихих часов: [start, end]; start===end → выключены */
const QUIET_PRESETS: Array<{ label: string; start: number; end: number }> = [
  { label: 'Выключить', start: 0, end: 0 },
  { label: '21:00 – 08:00', start: 21, end: 8 },
  { label: '22:00 – 08:00', start: 22, end: 8 },
  { label: '23:00 – 07:00', start: 23, end: 7 },
  { label: '00:00 – 08:00', start: 0, end: 8 },
];

/**
 * Экраны /settings: частота напоминаний, тихие часы, форма обращения.
 * Основной экран собирает telegram.settings.service.ts (buildSettingsView).
 */
@Injectable()
export class TelegramNotifySettingsService implements OnModuleInit {
  private readonly logger = new Logger(TelegramNotifySettingsService.name);

  constructor(
    @Inject(TELEGRAF_BOT) @Optional() private readonly bot: Telegraf<Context> | null,
    private readonly botService: BotService,
    private readonly scheduleService: TelegramScheduleService,
  ) {}

  private async backToSettings(ctx: Context, userId: bigint) {
    const { text, keyboard } = await buildSettingsView(this.botService, userId);
    await ctx.editMessageText(text, keyboard as any);
  }

  async onModuleInit() {
    if (!this.bot) return;

    this.bot.action('settings:pick_freq', async (ctx) => {
      try {
        await ctx.answerCbQuery();
        const rows = CADENCE_LABELS.map((label, i) =>
          [Markup.button.callback(label[0].toUpperCase() + label.slice(1), `settings:freq:${i}`)]);
        rows.push([Markup.button.callback('⬅️ Назад', 'settings:back')]);
        await ctx.editMessageText(
          'Как часто напоминать о дневнике?\n\nЕсли напоминания будут оставаться без ответа, я сам начну писать реже — а когда записи вернутся, вернусь к выбранной частоте.',
          Markup.inlineKeyboard(rows) as any,
        );
      } catch (err) {
        this.logger.error('settings:pick_freq failed', err);
        await ctx.answerCbQuery('Не получилось. Попробуй ещё раз.').catch(() => null);
      }
    });

    this.bot.action(/^settings:freq:([0-3])$/, async (ctx) => {
      try {
        const rawId = ctx.from?.id;
        await ctx.answerCbQuery();
        if (!rawId) return;
        const userId = BigInt(rawId);
        const level = Number((ctx.match as RegExpMatchArray)[1]);
        await this.botService.updateUserSettings(userId, { notifyFrequency: level });
        // Явный выбор сбрасывает адаптацию на выбранный уровень
        await this.botService.setAdaptiveLevel(userId, level);
        await this.scheduleService.rescheduleForUser(userId);
        await this.backToSettings(ctx, userId);
      } catch (err) {
        this.logger.error('settings:freq failed', err);
        await ctx.answerCbQuery('Не удалось сохранить.').catch(() => null);
      }
    });

    this.bot.action('settings:pick_quiet', async (ctx) => {
      try {
        await ctx.answerCbQuery();
        const rows = QUIET_PRESETS.map((p) =>
          [Markup.button.callback(p.label, `settings:quiet:${p.start}:${p.end}`)]);
        rows.push([Markup.button.callback('⬅️ Назад', 'settings:back')]);
        await ctx.editMessageText(
          'Тихие часы — в это время я не пишу вообще. Всё, что накопится, придёт утром.',
          Markup.inlineKeyboard(rows) as any,
        );
      } catch (err) {
        this.logger.error('settings:pick_quiet failed', err);
        await ctx.answerCbQuery('Не получилось. Попробуй ещё раз.').catch(() => null);
      }
    });

    this.bot.action(/^settings:quiet:(\d{1,2}):(\d{1,2})$/, async (ctx) => {
      try {
        const rawId = ctx.from?.id;
        await ctx.answerCbQuery();
        if (!rawId) return;
        const userId = BigInt(rawId);
        const start = Number((ctx.match as RegExpMatchArray)[1]);
        const end = Number((ctx.match as RegExpMatchArray)[2]);
        if (start > 23 || end > 23) return;
        if (!QUIET_PRESETS.some((p) => p.start === start && p.end === end)) return;
        await this.botService.updateUserSettings(userId, { notifyQuietStart: start, notifyQuietEnd: end });
        await this.backToSettings(ctx, userId);
      } catch (err) {
        this.logger.error('settings:quiet failed', err);
        await ctx.answerCbQuery('Не удалось сохранить.').catch(() => null);
      }
    });

    this.bot.action(/^settings:addr:(ty|vy)$/, async (ctx) => {
      try {
        const rawId = ctx.from?.id;
        await ctx.answerCbQuery();
        if (!rawId) return;
        const userId = BigInt(rawId);
        const form = (ctx.match as RegExpMatchArray)[1];
        await this.botService.updateUserSettings(userId, { addressForm: form });
        await this.backToSettings(ctx, userId);
      } catch (err) {
        this.logger.error('settings:addr failed', err);
        await ctx.answerCbQuery('Не удалось сохранить.').catch(() => null);
      }
    });
  }
}

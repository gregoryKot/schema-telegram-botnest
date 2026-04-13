import { Injectable, OnModuleInit, Inject, Optional, Logger } from '@nestjs/common';
import { Telegraf, Context, Markup } from 'telegraf';
import { TELEGRAF_BOT } from './telegram.constants';
import { BotService } from '../bot/bot.service';
import { NotificationService } from '../notification/notification.service';
import { TelegramScheduleService } from './telegram.schedule.service';

const TIMEZONES: { label: string; tz: string }[] = [
  { label: 'Лос-Анджелес', tz: 'America/Los_Angeles' },
  { label: 'Нью-Йорк', tz: 'America/New_York' },
  { label: 'Лондон', tz: 'Europe/London' },
  { label: 'Берлин, Варшава', tz: 'Europe/Berlin' },
  { label: 'Киев', tz: 'Europe/Kyiv' },
  { label: 'Израиль', tz: 'Asia/Jerusalem' },
  { label: 'Москва', tz: 'Europe/Moscow' },
  { label: 'Дубай', tz: 'Asia/Dubai' },
  { label: 'Ташкент', tz: 'Asia/Tashkent' },
  { label: 'Алматы', tz: 'Asia/Almaty' },
  { label: 'Пекин', tz: 'Asia/Shanghai' },
];

function tzOffsetAt(tz: string, date = new Date()): number {
  const utc = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  const local = new Date(date.toLocaleString('en-US', { timeZone: tz }));
  return Math.round((local.getTime() - utc.getTime()) / 3_600_000);
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

async function buildSettingsText(botService: BotService, userId: number): Promise<string> {
  const s = await botService.getUserSettings(userId);
  if (!s) return 'Настройки не найдены.';
  const tz = TIMEZONES.find((t) => t.tz === s.notifyTimezone)?.label ?? s.notifyTimezone;
  const offset = tzOffsetAt(s.notifyTimezone);
  const utcLabel = offset >= 0 ? `UTC+${offset}` : `UTC${offset}`;
  return [
    '⚙️ Настройки уведомлений',
    '',
    `Статус: ${s.notifyEnabled ? '🔔 Включены' : '🔕 Выключены'}`,
    `Время: ${pad(s.notifyLocalHour)}:00`,
    `Часовой пояс: ${tz} (${utcLabel})`,
  ].join('\n');
}

function buildSettingsKeyboard(notifyEnabled: boolean) {
  return Markup.inlineKeyboard([
    [Markup.button.callback(notifyEnabled ? '🔕 Выключить' : '🔔 Включить', 'settings:toggle')],
    [Markup.button.callback('🕐 Изменить время', 'settings:pick_hour')],
    [Markup.button.callback('🌍 Изменить часовой пояс', 'settings:pick_tz')],
  ]);
}

@Injectable()
export class TelegramSettingsService implements OnModuleInit {
  private readonly logger = new Logger(TelegramSettingsService.name);

  constructor(
    @Inject(TELEGRAF_BOT) @Optional() private readonly bot: Telegraf<Context> | null,
    private readonly botService: BotService,
    private readonly notificationService: NotificationService,
    private readonly scheduleService: TelegramScheduleService,
  ) {}

  async onModuleInit() {
    if (!this.bot) return;

    this.bot.command('settings', async (ctx) => {
      try {
        const userId = ctx.from?.id;
        if (!userId) return;
        const s = await this.botService.getUserSettings(userId);
        const text = await buildSettingsText(this.botService, userId);
        await ctx.reply(text, buildSettingsKeyboard(s?.notifyEnabled ?? true));
      } catch (err) {
        this.logger.error('settings command failed', err);
        await ctx.reply('Не удалось загрузить настройки. Попробуй ещё раз.').catch(() => null);
      }
    });

    this.bot.action('settings:toggle', async (ctx) => {
      try {
        const userId = ctx.from?.id;
        await ctx.answerCbQuery();
        if (!userId) return;
        const s = await this.botService.getUserSettings(userId);
        const newEnabled = !(s?.notifyEnabled ?? true);
        await this.botService.updateUserSettings(userId, { notifyEnabled: newEnabled });
        if (!newEnabled) {
          await this.notificationService.cancelAll(userId);
        } else {
          await this.scheduleService.rescheduleForUser(userId);
        }
        const text = await buildSettingsText(this.botService, userId);
        await ctx.editMessageText(text, buildSettingsKeyboard(newEnabled) as any);
      } catch (err) {
        this.logger.error('settings:toggle failed', err);
        await ctx.answerCbQuery('Не удалось сохранить. Попробуй ещё раз.').catch(() => null);
      }
    });

    this.bot.action('settings:pick_hour', async (ctx) => {
      try {
        await ctx.answerCbQuery();
        const hours = [8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23];
        const rows: ReturnType<typeof Markup.button.callback>[][] = [];
        for (let i = 0; i < hours.length; i += 4) {
          rows.push(hours.slice(i, i + 4).map((h) => Markup.button.callback(`${pad(h)}:00`, `settings:hour:${h}`)));
        }
        rows.push([Markup.button.callback('⬅️ Назад', 'settings:back')]);
        await ctx.editMessageText('Выбери время уведомления (в твоём часовом поясе):', Markup.inlineKeyboard(rows) as any);
      } catch (err) {
        this.logger.error('settings:pick_hour failed', err);
        await ctx.answerCbQuery('Не удалось сохранить. Попробуй ещё раз.').catch(() => null);
      }
    });

    this.bot.action(/^settings:hour:(\d+)$/, async (ctx) => {
      try {
        const userId = ctx.from?.id;
        await ctx.answerCbQuery();
        if (!userId) return;
        const localHour = Number((ctx.match as RegExpMatchArray)[1]);
        await this.botService.updateUserSettings(userId, { notifyLocalHour: localHour });
        await this.scheduleService.rescheduleForUser(userId);
        const text = await buildSettingsText(this.botService, userId);
        const updated = await this.botService.getUserSettings(userId);
        await ctx.editMessageText(text, buildSettingsKeyboard(updated?.notifyEnabled ?? true) as any);
      } catch (err) {
        this.logger.error('settings:hour failed', err);
        await ctx.answerCbQuery('Не удалось сохранить. Попробуй ещё раз.').catch(() => null);
      }
    });

    this.bot.action('settings:pick_tz', async (ctx) => {
      try {
        await ctx.answerCbQuery();
        const buttons = TIMEZONES.map((entry) => {
          const offset = tzOffsetAt(entry.tz);
          const utcLabel = offset >= 0 ? `UTC+${offset}` : `UTC${offset}`;
          return [Markup.button.callback(`${entry.label} (${utcLabel})`, `settings:tz:${entry.tz}`)];
        });
        buttons.push([Markup.button.callback('⬅️ Назад', 'settings:back')]);
        await ctx.editMessageText('Выбери свой часовой пояс:', Markup.inlineKeyboard(buttons) as any);
      } catch (err) {
        this.logger.error('settings:pick_tz failed', err);
        await ctx.answerCbQuery('Не удалось сохранить. Попробуй ещё раз.').catch(() => null);
      }
    });

    this.bot.action(/^settings:tz:(.+)$/, async (ctx) => {
      try {
        const userId = ctx.from?.id;
        await ctx.answerCbQuery();
        if (!userId) return;
        const timezone = (ctx.match as RegExpMatchArray)[1];
        if (!TIMEZONES.find((t) => t.tz === timezone)) return;
        await this.botService.updateUserSettings(userId, { notifyTimezone: timezone });
        await this.scheduleService.rescheduleForUser(userId);
        const text = await buildSettingsText(this.botService, userId);
        const updated = await this.botService.getUserSettings(userId);
        await ctx.editMessageText(text, buildSettingsKeyboard(updated?.notifyEnabled ?? true) as any);
      } catch (err) {
        this.logger.error('settings:tz failed', err);
        await ctx.answerCbQuery('Не удалось сохранить. Попробуй ещё раз.').catch(() => null);
      }
    });

    this.bot.action('settings:back', async (ctx) => {
      try {
        const userId = ctx.from?.id;
        await ctx.answerCbQuery();
        if (!userId) return;
        const s = await this.botService.getUserSettings(userId);
        const text = await buildSettingsText(this.botService, userId);
        await ctx.editMessageText(text, buildSettingsKeyboard(s?.notifyEnabled ?? true) as any);
      } catch (err) {
        this.logger.error('settings:back failed', err);
        await ctx.answerCbQuery('Не удалось сохранить. Попробуй ещё раз.').catch(() => null);
      }
    });
  }
}

import { Injectable, OnModuleInit, Inject, Optional, Logger } from '@nestjs/common';
import { Telegraf, Context, Markup } from 'telegraf';
import { TELEGRAF_BOT } from './telegram.constants';
import { BotService } from '../bot/bot.service';

const TIMEZONES: { label: string; offset: number }[] = [
  { label: 'UTC−8 (Лос-Анджелес)', offset: -8 },
  { label: 'UTC−5 (Нью-Йорк)', offset: -5 },
  { label: 'UTC+0 (Лондон)', offset: 0 },
  { label: 'UTC+1 (Берлин, Варшава)', offset: 1 },
  { label: 'UTC+2 (Израиль, Киев)', offset: 2 },
  { label: 'UTC+3 (Москва)', offset: 3 },
  { label: 'UTC+4 (Дубай)', offset: 4 },
  { label: 'UTC+5 (Ташкент)', offset: 5 },
  { label: 'UTC+6 (Алматы)', offset: 6 },
  { label: 'UTC+8 (Пекин)', offset: 8 },
];

function toUtcHour(localHour: number, tzOffset: number): number {
  return ((localHour - tzOffset) % 24 + 24) % 24;
}

function toLocalHour(utcHour: number, tzOffset: number): number {
  return ((utcHour + tzOffset) % 24 + 24) % 24;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

async function buildSettingsText(botService: BotService, userId: number): Promise<string> {
  const s = await botService.getUserSettings(userId);
  if (!s) return 'Настройки не найдены.';
  const tz = TIMEZONES.find((t) => t.offset === s.notifyTzOffset) ?? { label: `UTC+${s.notifyTzOffset}`, offset: s.notifyTzOffset };
  const localHour = toLocalHour(s.notifyUtcHour, s.notifyTzOffset);
  return [
    '⚙️ Настройки уведомлений',
    '',
    `Статус: ${s.notifyEnabled ? '🔔 Включены' : '🔕 Выключены'}`,
    `Время: ${pad(localHour)}:00`,
    `Часовой пояс: ${tz.label}`,
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
        const text = await buildSettingsText(this.botService, userId);
        await ctx.editMessageText(text, buildSettingsKeyboard(newEnabled) as any);
      } catch (err) {
        this.logger.error('settings:toggle failed', err);
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
      }
    });

    this.bot.action(/^settings:hour:(\d+)$/, async (ctx) => {
      try {
        const userId = ctx.from?.id;
        await ctx.answerCbQuery();
        if (!userId) return;
        const localHour = Number((ctx.match as RegExpMatchArray)[1]);
        const s = await this.botService.getUserSettings(userId);
        const tzOffset = s?.notifyTzOffset ?? 2;
        await this.botService.updateUserSettings(userId, { notifyUtcHour: toUtcHour(localHour, tzOffset) });
        const text = await buildSettingsText(this.botService, userId);
        const updated = await this.botService.getUserSettings(userId);
        await ctx.editMessageText(text, buildSettingsKeyboard(updated?.notifyEnabled ?? true) as any);
      } catch (err) {
        this.logger.error('settings:hour failed', err);
      }
    });

    this.bot.action('settings:pick_tz', async (ctx) => {
      try {
        await ctx.answerCbQuery();
        const buttons = TIMEZONES.map((tz) => [Markup.button.callback(tz.label, `settings:tz:${tz.offset}`)]);
        buttons.push([Markup.button.callback('⬅️ Назад', 'settings:back')]);
        await ctx.editMessageText('Выбери свой часовой пояс:', Markup.inlineKeyboard(buttons) as any);
      } catch (err) {
        this.logger.error('settings:pick_tz failed', err);
      }
    });

    this.bot.action(/^settings:tz:(-?\d+)$/, async (ctx) => {
      try {
        const userId = ctx.from?.id;
        await ctx.answerCbQuery();
        if (!userId) return;
        const tzOffset = Number((ctx.match as RegExpMatchArray)[1]);
        const s = await this.botService.getUserSettings(userId);
        const localHour = toLocalHour(s?.notifyUtcHour ?? 19, s?.notifyTzOffset ?? 2);
        await this.botService.updateUserSettings(userId, { notifyTzOffset: tzOffset, notifyUtcHour: toUtcHour(localHour, tzOffset) });
        const text = await buildSettingsText(this.botService, userId);
        const updated = await this.botService.getUserSettings(userId);
        await ctx.editMessageText(text, buildSettingsKeyboard(updated?.notifyEnabled ?? true) as any);
      } catch (err) {
        this.logger.error('settings:tz failed', err);
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
      }
    });
  }
}

import {
  Injectable,
  OnModuleInit,
  Inject,
  Optional,
  Logger,
} from '@nestjs/common';
import { Telegraf, Context, Markup } from 'telegraf';
import { TELEGRAF_BOT, ERROR_RETRY } from './telegram.constants';
import { failSettings } from './callback-failure';
import { BotService } from '../bot/bot.service';
import { AccountService } from '../bot/account.service';
import { NotificationService } from '../notification/notification.service';
import { TelegramScheduleService } from './telegram.schedule.service';
import { tzOffsetAt } from '../notification/notification.time';
import { normalizeAddressForm, t } from '../notification/address-form';
import { TIMEZONES, buildSettingsView } from './telegram.settings.view';
import { REMINDER_HOURS, buildHourRows } from './telegram.reminder-hours';

// Сборка экрана переехала в telegram.settings.view.ts (правило №10 — лимит
// размера файла). Ре-экспорт оставлен ради соседей и спек, которые берут
// buildSettingsView отсюда.
export { buildSettingsView };

@Injectable()
export class TelegramSettingsService implements OnModuleInit {
  private readonly logger = new Logger(TelegramSettingsService.name);

  constructor(
    @Inject(TELEGRAF_BOT)
    @Optional()
    private readonly bot: Telegraf<Context> | null,
    private readonly botService: BotService,
    private readonly accountService: AccountService,
    private readonly notificationService: NotificationService,
    private readonly scheduleService: TelegramScheduleService,
  ) {}

  onModuleInit() {
    if (!this.bot) return;

    this.bot.command('settings', async (ctx) => {
      try {
        const rawId = ctx.from?.id;
        if (!rawId) return;
        const userId = await this.accountService.canonicalUserId(rawId);
        const { text, keyboard } = await buildSettingsView(
          this.botService,
          userId,
        );
        await ctx.reply(text, keyboard);
      } catch (err) {
        this.logger.error('settings command failed', err);
        await ctx.reply(ERROR_RETRY).catch(() => null);
      }
    });

    this.bot.action('settings:toggle', async (ctx) => {
      try {
        const rawId = ctx.from?.id;
        await ctx.answerCbQuery();
        if (!rawId) return;
        const userId = await this.accountService.canonicalUserId(rawId);
        const s = await this.botService.getUserSettings(userId);
        const newEnabled = !(s?.notifyEnabled ?? true);
        await this.botService.updateUserSettings(userId, {
          notifyEnabled: newEnabled,
        });
        if (!newEnabled) {
          await this.notificationService.cancelAll(userId);
        } else {
          await this.scheduleService.rescheduleForUser(userId);
        }
        const { text, keyboard } = await buildSettingsView(
          this.botService,
          userId,
        );
        await ctx.editMessageText(text, keyboard);
      } catch (err) {
        await failSettings(this.logger, ctx, 'settings:toggle', err);
      }
    });

    this.bot.action('settings:toggle_gamified', async (ctx) => {
      try {
        const rawId = ctx.from?.id;
        await ctx.answerCbQuery();
        if (!rawId) return;
        const userId = await this.accountService.canonicalUserId(rawId);
        const s = await this.botService.getUserSettings(userId);
        await this.botService.updateUserSettings(userId, {
          notifyGamified: !s?.notifyGamified,
        });
        // перепланируем: pending-напоминание пересоберётся с новым режимом
        await this.scheduleService.rescheduleForUser(userId);
        const { text, keyboard } = await buildSettingsView(
          this.botService,
          userId,
        );
        await ctx.editMessageText(text, keyboard);
      } catch (err) {
        await failSettings(this.logger, ctx, 'settings:toggle_gamified', err);
      }
    });

    this.bot.action('settings:pick_hour', async (ctx) => {
      try {
        const rawId = ctx.from?.id;
        await ctx.answerCbQuery();
        if (!rawId) return;
        const userId = await this.accountService.canonicalUserId(rawId);
        const s = await this.botService.getUserSettings(userId);
        const form = normalizeAddressForm(s?.addressForm);
        const rows = buildHourRows();
        rows.push([Markup.button.callback('⬅️ Назад', 'settings:back')]);
        await ctx.editMessageText(
          t(
            form,
            'Выбери время уведомления (в твоём часовом поясе):',
            'Выберите время уведомления (в вашем часовом поясе):',
          ),
          Markup.inlineKeyboard(rows),
        );
      } catch (err) {
        await failSettings(this.logger, ctx, 'settings:pick_hour', err);
      }
    });

    this.bot.action(/^settings:hour:(\d+)$/, async (ctx) => {
      try {
        const rawId = ctx.from?.id;
        await ctx.answerCbQuery();
        if (!rawId) return;
        const userId = await this.accountService.canonicalUserId(rawId);
        const localHour = Number((ctx.match as RegExpMatchArray)[1]);
        // allow-list = кнопки pick_hour (telegram.reminder-hours.ts)
        if (!REMINDER_HOURS.includes(localHour)) return;
        await this.botService.updateUserSettings(userId, {
          notifyLocalHour: localHour,
        });
        await this.scheduleService.rescheduleForUser(userId);
        const { text, keyboard } = await buildSettingsView(
          this.botService,
          userId,
        );
        await ctx.editMessageText(text, keyboard);
      } catch (err) {
        await failSettings(this.logger, ctx, 'settings:hour', err);
      }
    });

    this.bot.action('settings:pick_tz', async (ctx) => {
      try {
        const rawId = ctx.from?.id;
        await ctx.answerCbQuery();
        if (!rawId) return;
        const userId = await this.accountService.canonicalUserId(rawId);
        const s = await this.botService.getUserSettings(userId);
        const form = normalizeAddressForm(s?.addressForm);
        const buttons = TIMEZONES.map((entry) => {
          const offset = tzOffsetAt(entry.tz);
          const utcLabel = offset >= 0 ? `UTC+${offset}` : `UTC${offset}`;
          return [
            Markup.button.callback(
              `${entry.label} (${utcLabel})`,
              `settings:tz:${entry.tz}`,
            ),
          ];
        });
        buttons.push([Markup.button.callback('⬅️ Назад', 'settings:back')]);
        await ctx.editMessageText(
          t(form, 'Выбери свой часовой пояс:', 'Выберите свой часовой пояс:'),
          Markup.inlineKeyboard(buttons),
        );
      } catch (err) {
        await failSettings(this.logger, ctx, 'settings:pick_tz', err);
      }
    });

    this.bot.action(/^settings:tz:(.+)$/, async (ctx) => {
      try {
        const rawId = ctx.from?.id;
        await ctx.answerCbQuery();
        if (!rawId) return;
        const userId = await this.accountService.canonicalUserId(rawId);
        const timezone = (ctx.match as RegExpMatchArray)[1];
        if (!TIMEZONES.find((t) => t.tz === timezone)) return;
        await this.botService.updateUserSettings(userId, {
          notifyTimezone: timezone,
        });
        await this.scheduleService.rescheduleForUser(userId);
        const { text, keyboard } = await buildSettingsView(
          this.botService,
          userId,
        );
        await ctx.editMessageText(text, keyboard);
      } catch (err) {
        await failSettings(this.logger, ctx, 'settings:tz', err);
      }
    });

    this.bot.action('settings:back', async (ctx) => {
      try {
        const rawId = ctx.from?.id;
        await ctx.answerCbQuery();
        if (!rawId) return;
        const userId = await this.accountService.canonicalUserId(rawId);
        const { text, keyboard } = await buildSettingsView(
          this.botService,
          userId,
        );
        await ctx.editMessageText(text, keyboard);
      } catch (err) {
        await failSettings(this.logger, ctx, 'settings:back', err);
      }
    });
  }
}

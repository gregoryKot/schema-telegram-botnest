import {
  Injectable,
  OnModuleInit,
  Inject,
  Optional,
  Logger,
} from '@nestjs/common';
import { Telegraf, Context, Markup } from 'telegraf';
import { TELEGRAF_BOT, ERROR_RETRY } from './telegram.constants';
import { BotService } from '../bot/bot.service';
import { AccountService } from '../bot/account.service';
import { NotificationService } from '../notification/notification.service';
import { TelegramScheduleService } from './telegram.schedule.service';
import { tzOffsetAt } from '../notification/notification.time';
import { normalizeAddressForm, t } from '../notification/address-form';
import { TIMEZONES, pad, buildSettingsView } from './telegram.settings.view';

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
        this.logger.error('settings:toggle failed', err);
        await ctx.answerCbQuery(ERROR_RETRY).catch(() => null);
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
        this.logger.error('settings:toggle_gamified failed', err);
        await ctx.answerCbQuery(ERROR_RETRY).catch(() => null);
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
        const hours = [
          8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23,
        ];
        const rows: ReturnType<typeof Markup.button.callback>[][] = [];
        for (let i = 0; i < hours.length; i += 4) {
          rows.push(
            hours
              .slice(i, i + 4)
              .map((h) =>
                Markup.button.callback(`${pad(h)}:00`, `settings:hour:${h}`),
              ),
          );
        }
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
        this.logger.error('settings:pick_hour failed', err);
        await ctx.answerCbQuery(ERROR_RETRY).catch(() => null);
      }
    });

    this.bot.action(/^settings:hour:(\d+)$/, async (ctx) => {
      try {
        const rawId = ctx.from?.id;
        await ctx.answerCbQuery();
        if (!rawId) return;
        const userId = await this.accountService.canonicalUserId(rawId);
        const localHour = Number((ctx.match as RegExpMatchArray)[1]);
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
        this.logger.error('settings:hour failed', err);
        await ctx.answerCbQuery(ERROR_RETRY).catch(() => null);
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
        this.logger.error('settings:pick_tz failed', err);
        await ctx.answerCbQuery(ERROR_RETRY).catch(() => null);
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
        this.logger.error('settings:tz failed', err);
        await ctx.answerCbQuery(ERROR_RETRY).catch(() => null);
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
        this.logger.error('settings:back failed', err);
        await ctx.answerCbQuery(ERROR_RETRY).catch(() => null);
      }
    });
  }
}

import {
  Injectable,
  OnModuleInit,
  Inject,
  Optional,
  Logger,
} from '@nestjs/common';
import { Telegraf, Context } from 'telegraf';
import { TELEGRAF_BOT } from './telegram.constants';
import { failSettings } from './callback-failure';
import { BotService } from '../bot/bot.service';
import { AccountService } from '../bot/account.service';
import { TelegramScheduleService } from './telegram.schedule.service';
import { buildSettingsView } from './telegram.settings.view';
import { summaryOn } from '../notification/notify-toggles';

/**
 * Тумблер «Итоги дня» в /settings бота (хвост волны 3). Решение владельца Р1:
 * «Напоминания» и «Итоги дня» — два тумблера, как на сайте; до этого бот
 * показывал только статус итогов, выключить их можно было лишь на сайте.
 * Итоги — сводка после заполнения, вехи серии, «с возвращением»
 * (telegram.diary-complete.ts). Выключение снимает и уже стоящую сводку дня:
 * это делает rescheduleForUser (telegram.schedule-reschedule.ts), как после
 * тумблера на сайте. Своим сервисом: соседние экраны /settings упираются в
 * храповик размера (правило №10).
 */
@Injectable()
export class TelegramSummaryToggleService implements OnModuleInit {
  private readonly logger = new Logger(TelegramSummaryToggleService.name);

  constructor(
    @Inject(TELEGRAF_BOT)
    @Optional()
    private readonly bot: Telegraf<Context> | null,
    private readonly botService: BotService,
    private readonly accountService: AccountService,
    private readonly scheduleService: TelegramScheduleService,
  ) {}

  onModuleInit() {
    if (!this.bot) return;

    this.bot.action('settings:toggle_summary', async (ctx) => {
      try {
        const rawId = ctx.from?.id;
        await ctx.answerCbQuery();
        if (!rawId) return;
        const userId = await this.accountService.canonicalUserId(rawId);
        const s = await this.botService.getUserSettings(userId);
        await this.botService.updateUserSettings(userId, {
          notifySummaryEnabled: !summaryOn(s),
        });
        await this.scheduleService.rescheduleForUser(userId);
        const { text, keyboard } = await buildSettingsView(
          this.botService,
          userId,
        );
        await ctx.editMessageText(text, keyboard);
      } catch (err) {
        await failSettings(this.logger, ctx, 'settings:toggle_summary', err);
      }
    });
  }
}

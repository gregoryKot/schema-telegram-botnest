import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Telegraf, Context, Markup } from 'telegraf';
import { TELEGRAF_BOT, BOOKING_URL } from './telegram.constants';

const MINIAPP_URL = 'https://schema-miniapp.vercel.app';
import { BotService, Need, NeedId } from '../bot/bot.service';

const MONTHS = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];

function formatDate(date: Date): string {
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

export function buildSummaryText(needs: Need[], ratings: Partial<Record<NeedId, number>>, tzOffset = 0): string {
  const lines = needs.map((n) => {
    const v = ratings[n.id] ?? 0;
    return `${n.emoji} ${'🟩'.repeat(v)}${'⬜'.repeat(10 - v)} ${v}/10`;
  });
  const legend = needs.map((n) => `${n.emoji} ${n.chartLabel}`).join(' · ');
  const localDate = new Date(Date.now() + tzOffset * 3600_000);
  return `📔 Дневник потребностей · ${formatDate(localDate)}\n\n${lines.join('\n')}\n\n${legend}`;
}

@Injectable()
export class TelegramScheduleService {
  private readonly logger = new Logger(TelegramScheduleService.name);

  constructor(
    @Inject(TELEGRAF_BOT) @Optional() private readonly bot: Telegraf<Context> | null,
    private readonly botService: BotService,
  ) {}

  @Cron('0 * * * *')
  async sendDailySummary() {
    if (!this.bot) return;

    const utcHour = new Date().getUTCHours();
    const userIds = await this.botService.getUsersToNotify(utcHour);
    this.logger.log(`[${utcHour}:00 UTC] Sending daily summary to ${userIds.length} users`);

    for (const userId of userIds) {
      try {
        const settings = await this.botService.getUserSettings(userId);
        const tzOffset = settings?.notifyTzOffset ?? 0;
        const ratings = await this.botService.getRatings(userId);

        if (Object.keys(ratings).length === 0) {
          await this.bot.telegram.sendMessage(
            userId,
            '📔 Как ты сегодня?\n\nЕщё не отметил потребности — это займёт минуту.',
            { reply_markup: Markup.inlineKeyboard([[Markup.button.webApp('📱 Открыть дневник', MINIAPP_URL)]]).reply_markup },
          );
          continue;
        }

        await this.bot.telegram.sendMessage(
          userId,
          buildSummaryText(this.botService.getNeeds(), ratings, tzOffset),
        );

        const lowNeeds = await this.botService.getLowStreakNeeds(userId, 5, 3);
        if (lowNeeds.length > 0) {
          const needs = this.botService.getNeeds();
          const emojis = lowNeeds.map((id) => needs.find((n) => n.id === id)!.emoji).join(' ');
          await this.bot.telegram.sendMessage(
            userId,
            `${emojis} — замечаю, что эти потребности уже несколько дней остаются невысокими.\n\nИногда за этим стоит что-то важное. Если хочется разобраться — я здесь.`,
            { reply_markup: Markup.inlineKeyboard([[Markup.button.url('📝 Записаться на сессию', BOOKING_URL)]]).reply_markup },
          );
        }
      } catch (err) {
        this.logger.error(`Failed to send summary to userId=${userId}`, err);
      }
    }

    this.logger.log('Daily summaries sent');
  }
}

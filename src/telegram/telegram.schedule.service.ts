import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Telegraf, Context } from 'telegraf';
import { TELEGRAF_BOT } from './telegram.constants';
import { BotService, Need, NeedId } from '../bot/bot.service';

const MONTHS = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];

function formatDate(date: Date): string {
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

export function buildSummaryText(needs: Need[], ratings: Partial<Record<NeedId, number>>): string {
  const lines = needs.map((n) => {
    const v = ratings[n.id] ?? 0;
    return `${n.emoji} ${'🟩'.repeat(v)}${'⬜'.repeat(10 - v)} ${v}/10`;
  });
  const legend = needs.map((n) => `${n.emoji} ${n.chartLabel}`).join(' · ');
  return `📔 Дневник потребностей · ${formatDate(new Date())}\n\n${lines.join('\n')}\n\n${legend}`;
}

@Injectable()
export class TelegramScheduleService {
  private readonly logger = new Logger(TelegramScheduleService.name);

  constructor(
    @Inject(TELEGRAF_BOT) @Optional() private readonly bot: Telegraf<Context> | null,
    private readonly botService: BotService,
  ) {}

  // 21:00 GMT+2 = 19:00 UTC
  @Cron('0 19 * * *')
  async sendDailySummary() {
    if (!this.bot) return;

    const userIds = await this.botService.getAllUserIds();
    this.logger.log(`Sending daily summary to ${userIds.length} users`);

    for (const userId of userIds) {
      try {
        const ratings = await this.botService.getRatings(userId);
        if (Object.keys(ratings).length === 0) continue;

        const text = buildSummaryText(this.botService.getNeeds(), ratings);
        await this.bot.telegram.sendMessage(userId, text);
      } catch (err) {
        this.logger.error(`Failed to send summary to userId=${userId}`, err);
      }
    }

    this.logger.log('Daily summaries sent');
  }
}

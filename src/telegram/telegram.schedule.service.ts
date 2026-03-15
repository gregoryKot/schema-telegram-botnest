import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Telegraf, Context } from 'telegraf';
import { TELEGRAF_BOT } from './telegram.constants';
import { BotService } from '../bot/bot.service';
import { ChartService } from '../chart/chart.service';

const DAILY_CAPTION = '📊 Твоё колесо потребностей за сегодня';

@Injectable()
export class TelegramScheduleService {
  private readonly logger = new Logger(TelegramScheduleService.name);

  constructor(
    @Inject(TELEGRAF_BOT) @Optional() private readonly bot: Telegraf<Context> | null,
    private readonly botService: BotService,
    private readonly chartService: ChartService,
  ) {}

  // 21:00 GMT+2 = 19:00 UTC
  @Cron('0 19 * * *')
  async sendDailyCharts() {
    if (!this.bot) return;

    const userIds = await this.botService.getAllUserIds();
    this.logger.log(`Sending daily charts to ${userIds.length} users`);

    for (const userId of userIds) {
      try {
        const ratings = await this.botService.getRatings(userId);
        if (Object.keys(ratings).length === 0) continue;

        const buffer = await this.chartService.generateRadarChart(this.botService.getNeeds(), ratings);
        await this.bot.telegram.sendPhoto(userId, { source: buffer }, { caption: DAILY_CAPTION });
      } catch (err) {
        this.logger.error(`Failed to send chart to userId=${userId}`, err);
      }
    }

    this.logger.log('Daily charts sent');
  }
}

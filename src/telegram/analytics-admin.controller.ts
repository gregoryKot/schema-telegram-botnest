import {
  Controller,
  Get,
  Headers,
  Logger,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BotAdminStatsService } from '../bot/bot.admin-stats.service';
import { HealthyAdultService } from '../bot/healthy-adult.service';
import { StatsReportService } from '../bot/stats-report.service';
import {
  STATS_MAIN_ID,
  STATS_SECTIONS,
  findStatsSection,
} from '../bot/stats-sections';
import { AdminThrottle, assertAdminKey } from '../booking/admin-key.util';
import {
  AdminAnalyticsQueryDto,
  DEFAULT_ADMIN_DAYS,
} from '../analytics/admin/admin-analytics.dto';
import { AdminAnalyticsService } from '../analytics/admin/admin-analytics.service';
import type {
  AdminStatsSectionInfo,
  AdminStatsSectionText,
} from '../analytics/admin/admin-analytics.types';
import {
  collectMainStats,
  collectStatsSection,
  type StatsDeps,
} from './stats-screens';

const MAIN_SECTION: AdminStatsSectionInfo = {
  id: STATS_MAIN_ID,
  title: 'Главные цифры',
};

/** Аналитика в админке сайта (x-admin-key, как вся админка). Живёт в
 *  TelegramModule: разделы отчёта берут тот же текст, что и /stats в боте. */
@AdminThrottle()
@Controller('api/analytics/admin')
export class AnalyticsAdminController {
  private readonly logger = new Logger(AnalyticsAdminController.name);
  private readonly adminKey: string;
  private readonly deps: StatsDeps;

  constructor(
    private readonly analytics: AdminAnalyticsService,
    adminStats: BotAdminStatsService,
    statsReport: StatsReportService,
    healthyAdult: HealthyAdultService,
    config: ConfigService,
  ) {
    this.adminKey = config.get<string>('ADMIN_BOOKING_KEY') ?? '';
    this.deps = { adminStats, statsReport, healthyAdult };
  }

  @Get('overview')
  overview(
    @Query() q: AdminAnalyticsQueryDto,
    @Headers('x-admin-key') key: string,
  ) {
    assertAdminKey(key, this.adminKey);
    return this.analytics.overview(q.days ?? DEFAULT_ADMIN_DAYS);
  }

  @Get('therapists')
  therapists(
    @Query() q: AdminAnalyticsQueryDto,
    @Headers('x-admin-key') key: string,
  ) {
    assertAdminKey(key, this.adminKey);
    return this.analytics.therapists(q.days ?? DEFAULT_ADMIN_DAYS);
  }

  @Get('people')
  people(
    @Query() q: AdminAnalyticsQueryDto,
    @Headers('x-admin-key') key: string,
  ) {
    assertAdminKey(key, this.adminKey);
    return this.analytics.people(q.days ?? DEFAULT_ADMIN_DAYS);
  }

  @Get('sections')
  sections(@Headers('x-admin-key') key: string): AdminStatsSectionInfo[] {
    assertAdminKey(key, this.adminKey);
    return [
      MAIN_SECTION,
      ...STATS_SECTIONS.map(({ id, title }) => ({ id, title })),
    ];
  }

  @Get('sections/:id')
  async section(
    @Param('id') id: string,
    @Headers('x-admin-key') key: string,
  ): Promise<AdminStatsSectionText> {
    assertAdminKey(key, this.adminKey);
    if (id === STATS_MAIN_ID) {
      const text = await collectMainStats(this.deps, this.logger);
      return { ...MAIN_SECTION, text };
    }
    const section = findStatsSection(id);
    if (!section) throw new NotFoundException('Unknown section');
    const text = await collectStatsSection(id, this.deps, this.logger);
    return { id: section.id, title: section.title, text };
  }
}

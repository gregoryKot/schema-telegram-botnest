import { Module } from '@nestjs/common';
import { BotService } from './bot.service';
import { BotAnalyticsService } from './bot.analytics.service';
import { BotAdminStatsService } from './bot.admin-stats.service';
import { BotClientOverviewService } from './bot.client-overview.service';
import { ProductMetricsService } from './bot.product-metrics.service';
import { StatsReportService } from './stats-report.service';
import { DiaryService } from './diary.service';
import { ProfileService } from './profile.service';
import { AccountService } from './account.service';
import { YsqService } from './ysq.service';
import { PairsService } from './pairs.service';
import { PracticesService } from './practices.service';
import { ExercisesService } from './exercises.service';
import { PhraseCheckService } from './phrase-check.service';
import { NotesService } from './notes.service';
import { HealthyAdultService } from './healthy-adult.service';
import { JourneyService } from './journey.service';
import { PracticeSessionsService } from './practice-sessions.service';
import { INTERNAL_PROVIDERS } from './bot.internal-providers';

// Сервисы для других модулей: один список и в providers, и в exports (правило №10).
const EXPORTED_PROVIDERS = [
  BotService,
  BotAnalyticsService,
  BotAdminStatsService,
  BotClientOverviewService,
  ProductMetricsService,
  StatsReportService,
  DiaryService,
  ProfileService,
  AccountService,
  YsqService,
  PairsService,
  PracticesService,
  ExercisesService,
  PhraseCheckService,
  NotesService,
  HealthyAdultService,
  JourneyService,
  PracticeSessionsService,
];

@Module({
  providers: [...EXPORTED_PROVIDERS, ...INTERNAL_PROVIDERS],
  exports: EXPORTED_PROVIDERS,
})
export class BotModule {}

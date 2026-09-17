import { Module } from '@nestjs/common';
import { BotService } from './bot.service';
import { BotAnalyticsService } from './bot.analytics.service';
import { BotAdminStatsService } from './bot.admin-stats.service';
import { BotClientOverviewService } from './bot.client-overview.service';
import { ProductMetricsService } from './bot.product-metrics.service';
import { StatsReportService } from './stats-report.service';
import { QuizMetricsService } from './quiz-metrics.service';
import { PracticeLinkMetricsService } from './practice-link-metrics.service';
import { PracticeMetricsService } from './practice-metrics.service';
import { CaseMetricsService } from './case-metrics.service';
import { ModeCardMetricsService } from './mode-card-metrics.service';
import { ModeDiaryMetricsService } from './mode-diary-metrics.service';
import { WarmWordsMetricsService } from './warm-words-metrics.service';
import { AccountLinkMetricsService } from './account-link-metrics.service';
import { SignupSourceMetricsService } from './signup-source-metrics.service';
import { GameMetricsService } from './game-metrics.service';
import { DataExportMetricsService } from './data-export-metrics.service';
import { DiaryService } from './diary.service';
import { ProfileService } from './profile.service';
import { AccountService } from './account.service';
import { YsqService } from './ysq.service';
import { PairsService } from './pairs.service';
import { PracticesService } from './practices.service';
import { ExercisesService } from './exercises.service';
import { PhraseCheckService } from './phrase-check.service';
import { PhraseCheckMetricsService } from './phrase-check-metrics.service';
import { PlusMetricsService } from './plus-metrics.service';
import { WebBannerMetricsService } from './web-banner-metrics.service';
import { SiteInstallMetricsService } from './site-install-metrics.service';
import { ScreenMetricsService } from './screen-metrics.service';
import { ProfilePatternMetricsService } from './profile-pattern-metrics.service';
import { AuthHealthMetricsService } from './auth-health-metrics.service';
import { LoginTicketMetricsService } from './login-ticket-metrics.service';
import { ClientErrorMetricsService } from './client-error-metrics.service';
import { MoneyMetricsService } from './money-metrics.service';
import { NotesService } from './notes.service';
import { HealthyAdultService } from './healthy-adult.service';
import { JourneyService } from './journey.service';
import { PracticeSessionsService } from './practice-sessions.service';

// Сервисы для других модулей — один список сразу в providers и в exports
// (правило №10: новый экспортируемый сервис стоит 1 строку, а не 2).
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

// Только внутри BotModule (суб-агрегаты ProductMetricsService/StatsReportService).
const INTERNAL_PROVIDERS = [
  QuizMetricsService,
  PracticeLinkMetricsService,
  ModeCardMetricsService,
  ModeDiaryMetricsService,
  WarmWordsMetricsService,
  AccountLinkMetricsService,
  SignupSourceMetricsService,
  DataExportMetricsService,
  PracticeMetricsService,
  CaseMetricsService,
  PhraseCheckMetricsService,
  PlusMetricsService,
  WebBannerMetricsService,
  SiteInstallMetricsService,
  ScreenMetricsService,
  ProfilePatternMetricsService,
  AuthHealthMetricsService,
  LoginTicketMetricsService,
  ClientErrorMetricsService,
  MoneyMetricsService,
  GameMetricsService,
];

@Module({
  providers: [...EXPORTED_PROVIDERS, ...INTERNAL_PROVIDERS],
  exports: EXPORTED_PROVIDERS,
})
export class BotModule {}

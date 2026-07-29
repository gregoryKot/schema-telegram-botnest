import { Module } from '@nestjs/common';
import { BotService } from './bot.service';
import { BotAnalyticsService } from './bot.analytics.service';
import { BotClientOverviewService } from './bot.client-overview.service';
import { ProductMetricsService } from './bot.product-metrics.service';
import { QuizMetricsService } from './quiz-metrics.service';
import { PracticeLinkMetricsService } from './practice-link-metrics.service';
import { DiaryService } from './diary.service';
import { ProfileService } from './profile.service';
import { AccountService } from './account.service';
import { YsqService } from './ysq.service';
import { PairsService } from './pairs.service';
import { PracticesService } from './practices.service';
import { ExercisesService } from './exercises.service';
import { NotesService } from './notes.service';
import { HealthyAdultService } from './healthy-adult.service';
import { JourneyService } from './journey.service';
import { PracticeSessionsService } from './practice-sessions.service';

@Module({
  providers: [
    BotService,
    BotAnalyticsService,
    BotClientOverviewService,
    ProductMetricsService,
    QuizMetricsService,
    PracticeLinkMetricsService,
    DiaryService,
    ProfileService,
    AccountService,
    YsqService,
    PairsService,
    PracticesService,
    ExercisesService,
    NotesService,
    HealthyAdultService,
    JourneyService,
    PracticeSessionsService,
  ],
  exports: [
    BotService,
    BotAnalyticsService,
    BotClientOverviewService,
    ProductMetricsService,
    DiaryService,
    ProfileService,
    AccountService,
    YsqService,
    PairsService,
    PracticesService,
    ExercisesService,
    NotesService,
    HealthyAdultService,
    JourneyService,
    PracticeSessionsService,
  ],
})
export class BotModule {}

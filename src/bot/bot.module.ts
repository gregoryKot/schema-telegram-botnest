import { Module } from '@nestjs/common';
import { BotService } from './bot.service';
import { BotAnalyticsService } from './bot.analytics.service';
import { DiaryService } from './diary.service';
import { ProfileService } from './profile.service';
import { AccountService } from './account.service';
import { YsqService } from './ysq.service';
import { PairsService } from './pairs.service';
import { PracticesService } from './practices.service';
import { ExercisesService } from './exercises.service';
import { NotesService } from './notes.service';

@Module({
  providers: [
    BotService,
    BotAnalyticsService,
    DiaryService,
    ProfileService,
    AccountService,
    YsqService,
    PairsService,
    PracticesService,
    ExercisesService,
    NotesService,
  ],
  exports: [
    BotService,
    BotAnalyticsService,
    DiaryService,
    ProfileService,
    AccountService,
    YsqService,
    PairsService,
    PracticesService,
    ExercisesService,
    NotesService,
  ],
})
export class BotModule {}

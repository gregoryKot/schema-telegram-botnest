// Провайдеры только внутри BotModule: суб-агрегаты ProductMetricsService и
// блоки отчёта /stats (StatsReportService). Вынесены из bot.module.ts, чтобы
// новый блок метрик не раздувал модуль сверх потолка размера (правило №10).
// Оба списка отсортированы: две ветки, добавившие по блоку, вставляют строки в
// разные места, а не в общий хвост (правило №13).
import { AccountLinkMetricsService } from './account-link-metrics.service';
import { AuthHealthMetricsService } from './auth-health-metrics.service';
import { BookingRetentionMetricsService } from './booking-retention-metrics.service';
import { CaseMetricsService } from './case-metrics.service';
import { ClientErrorMetricsService } from './client-error-metrics.service';
import { ConceptGraphMetricsService } from './concept-graph-metrics.service';
import { DataExportMetricsService } from './data-export-metrics.service';
import { EntryDeleteMetricsService } from './entry-delete-metrics.service';
import { GameMetricsService } from './game-metrics.service';
import { IntroLeadMetricsService } from './intro-lead-metrics.service';
import { TherapyNudgeMetricsService } from './therapy-nudge-metrics.service';
import { LoginTicketMetricsService } from './login-ticket-metrics.service';
import { ModeCardMetricsService } from './mode-card-metrics.service';
import { ModeDiaryMetricsService } from './mode-diary-metrics.service';
import { MoneyMetricsService } from './money-metrics.service';
import { NotifyQueueMetricsService } from './notify-queue-metrics.service';
import { TherapistExitMetricsService } from './therapist-exit-metrics.service';
import { PhraseCheckMetricsService } from './phrase-check-metrics.service';
import { PlusMetricsService } from './plus-metrics.service';
import { PracticeLinkMetricsService } from './practice-link-metrics.service';
import { PracticeMetricsService } from './practice-metrics.service';
import { ProfilePatternMetricsService } from './profile-pattern-metrics.service';
import { QuizMetricsService } from './quiz-metrics.service';
import { ScreenMetricsService } from './screen-metrics.service';
import { SessionCurrencyMetricsService } from './session-currency-metrics.service';
import { SignupSourceMetricsService } from './signup-source-metrics.service';
import { SiteInstallMetricsService } from './site-install-metrics.service';
import { WarmWordsMetricsService } from './warm-words-metrics.service';
import { WebBannerMetricsService } from './web-banner-metrics.service';

export const INTERNAL_PROVIDERS = [
  AccountLinkMetricsService,
  AuthHealthMetricsService,
  BookingRetentionMetricsService,
  CaseMetricsService,
  ClientErrorMetricsService,
  ConceptGraphMetricsService,
  DataExportMetricsService,
  EntryDeleteMetricsService,
  GameMetricsService,
  IntroLeadMetricsService,
  TherapyNudgeMetricsService,
  LoginTicketMetricsService,
  ModeCardMetricsService,
  ModeDiaryMetricsService,
  MoneyMetricsService,
  NotifyQueueMetricsService,
  TherapistExitMetricsService,
  PhraseCheckMetricsService,
  PlusMetricsService,
  PracticeLinkMetricsService,
  PracticeMetricsService,
  ProfilePatternMetricsService,
  QuizMetricsService,
  ScreenMetricsService,
  SessionCurrencyMetricsService,
  SignupSourceMetricsService,
  SiteInstallMetricsService,
  WarmWordsMetricsService,
  WebBannerMetricsService,
];

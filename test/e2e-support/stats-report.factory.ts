// Сборка отчёта /stats без DI-контейнера: сервисы метрик, каждый с одной
// зависимостью — PrismaService. Потребителей два — test/raw-sql-live-stats.e2e-spec.ts
// (правило №18) и замер планов test/perf. Вторая копия конструктора разъехалась
// бы с первой на следующем же сервисе метрик, и замер перестал бы мерить то, что
// шлёт прод. AppModule целиком тут не поднимается: вместе с ним поднялись бы
// кроны, а их тик посреди сценария добавил бы в замер чужие запросы.
import { PrismaService } from '../../src/prisma/prisma.service';
import { StatsReportService } from '../../src/bot/stats-report.service';
import { ProductMetricsService } from '../../src/bot/bot.product-metrics.service';
import { QuizMetricsService } from '../../src/bot/quiz-metrics.service';
import { PracticeLinkMetricsService } from '../../src/bot/practice-link-metrics.service';
import { PracticeMetricsService } from '../../src/bot/practice-metrics.service';
import { CaseMetricsService } from '../../src/bot/case-metrics.service';
import { ModeCardMetricsService } from '../../src/bot/mode-card-metrics.service';
import { ModeDiaryMetricsService } from '../../src/bot/mode-diary-metrics.service';
import { WarmWordsMetricsService } from '../../src/bot/warm-words-metrics.service';
import { PhraseCheckMetricsService } from '../../src/bot/phrase-check-metrics.service';
import { EntryDeleteMetricsService } from '../../src/bot/entry-delete-metrics.service';
import { AccountLinkMetricsService } from '../../src/bot/account-link-metrics.service';
import { PlusMetricsService } from '../../src/bot/plus-metrics.service';
import { WebBannerMetricsService } from '../../src/bot/web-banner-metrics.service';
import { SiteInstallMetricsService } from '../../src/bot/site-install-metrics.service';
import { ScreenMetricsService } from '../../src/bot/screen-metrics.service';
import { ProfilePatternMetricsService } from '../../src/bot/profile-pattern-metrics.service';
import { ConceptGraphMetricsService } from '../../src/bot/concept-graph-metrics.service';
import { AuthHealthMetricsService } from '../../src/bot/auth-health-metrics.service';
import { LoginTicketMetricsService } from '../../src/bot/login-ticket-metrics.service';
import { ClientErrorMetricsService } from '../../src/bot/client-error-metrics.service';
import { MoneyMetricsService } from '../../src/bot/money-metrics.service';
import { SessionCurrencyMetricsService } from '../../src/bot/session-currency-metrics.service';
import { SignupSourceMetricsService } from '../../src/bot/signup-source-metrics.service';
import { GameMetricsService } from '../../src/bot/game-metrics.service';
import { DataExportMetricsService } from '../../src/bot/data-export-metrics.service';
import { BookingRetentionMetricsService } from '../../src/bot/booking-retention-metrics.service';
import { IntroLeadMetricsService } from '../../src/bot/intro-lead-metrics.service';
import { TherapyNudgeMetricsService } from '../../src/bot/therapy-nudge-metrics.service';
import { NotifyQueueMetricsService } from '../../src/bot/notify-queue-metrics.service';
import { TherapistExitMetricsService } from '../../src/bot/therapist-exit-metrics.service';

/** Продуктовый блок /stats (второе сообщение команды). */
export function buildStatsReport(prisma: PrismaService): StatsReportService {
  const product = new ProductMetricsService(
    prisma,
    new QuizMetricsService(prisma),
    new PracticeLinkMetricsService(prisma),
    new PracticeMetricsService(prisma),
    new CaseMetricsService(prisma),
  );
  return new StatsReportService(
    product,
    new ModeCardMetricsService(prisma),
    new ModeDiaryMetricsService(prisma),
    new WarmWordsMetricsService(prisma),
    new PhraseCheckMetricsService(prisma),
    new EntryDeleteMetricsService(prisma),
    new AccountLinkMetricsService(prisma),
    new PlusMetricsService(prisma),
    new WebBannerMetricsService(prisma),
    new SiteInstallMetricsService(prisma),
    new ScreenMetricsService(prisma),
    new ProfilePatternMetricsService(prisma),
    new ConceptGraphMetricsService(prisma),
    new AuthHealthMetricsService(prisma),
    new LoginTicketMetricsService(prisma),
    new ClientErrorMetricsService(prisma),
    new MoneyMetricsService(prisma),
    new SessionCurrencyMetricsService(prisma),
    new SignupSourceMetricsService(prisma),
    new GameMetricsService(prisma),
    new DataExportMetricsService(prisma),
    new BookingRetentionMetricsService(prisma),
    new IntroLeadMetricsService(prisma),
    new TherapyNudgeMetricsService(prisma),
    new NotifyQueueMetricsService(prisma),
    new TherapistExitMetricsService(prisma),
  );
}

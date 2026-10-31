import { Injectable, Logger } from '@nestjs/common';
import { ProductMetricsService } from './bot.product-metrics.service';
import { ModeCardMetricsService } from './mode-card-metrics.service';
import { ModeDiaryMetricsService } from './mode-diary-metrics.service';
import { WarmWordsMetricsService } from './warm-words-metrics.service';
import { PhraseCheckMetricsService } from './phrase-check-metrics.service';
import { EntryDeleteMetricsService } from './entry-delete-metrics.service';
import { AccountLinkMetricsService } from './account-link-metrics.service';
import { SignupSourceMetricsService } from './signup-source-metrics.service';
import { PlusMetricsService } from './plus-metrics.service';
import { WebBannerMetricsService } from './web-banner-metrics.service';
import { SiteInstallMetricsService } from './site-install-metrics.service';
import { ScreenMetricsService } from './screen-metrics.service';
import { ProfilePatternMetricsService } from './profile-pattern-metrics.service';
import { ConceptGraphMetricsService } from './concept-graph-metrics.service';
import { AuthHealthMetricsService } from './auth-health-metrics.service';
import { LoginTicketMetricsService } from './login-ticket-metrics.service';
import { ClientErrorMetricsService } from './client-error-metrics.service';
import { NotifyQueueMetricsService } from './notify-queue-metrics.service';
import { MoneyMetricsService } from './money-metrics.service';
import { SessionCurrencyMetricsService } from './session-currency-metrics.service';
import { GameMetricsService } from './game-metrics.service';
import { DataExportMetricsService } from './data-export-metrics.service';
import { BookingRetentionMetricsService } from './booking-retention-metrics.service';
import { IntroLeadMetricsService } from './intro-lead-metrics.service';
import { TherapyNudgeMetricsService } from './therapy-nudge-metrics.service';
import { TherapistExitMetricsService } from './therapist-exit-metrics.service';
import { statsBlocks } from './stats-report.blocks';
import { findStatsSection } from './stats-sections';
import { infraBlocks } from './stats-infra-blocks';
import { settleBlocks } from './stats-settle';

// Склейка отчёта /stats (№10); поля конструктора открыты — их берёт список
// блоков (stats-report.blocks.ts). Блок упал — строка-заглушка (stats-settle.ts).
@Injectable()
export class StatsReportService {
  private readonly logger = new Logger(StatsReportService.name);

  constructor(
    readonly product: ProductMetricsService,
    readonly modeCard: ModeCardMetricsService,
    readonly modeDiary: ModeDiaryMetricsService,
    readonly warmWords: WarmWordsMetricsService,
    readonly phraseChecks: PhraseCheckMetricsService,
    readonly entryDelete: EntryDeleteMetricsService,
    readonly accountLink: AccountLinkMetricsService,
    readonly plus: PlusMetricsService,
    readonly webBanner: WebBannerMetricsService,
    readonly siteInstall: SiteInstallMetricsService,
    readonly screen: ScreenMetricsService,
    readonly profilePattern: ProfilePatternMetricsService,
    readonly conceptGraph: ConceptGraphMetricsService,
    readonly authHealth: AuthHealthMetricsService,
    readonly loginTicket: LoginTicketMetricsService,
    readonly clientErrors: ClientErrorMetricsService,
    readonly money: MoneyMetricsService,
    readonly sessionCurrency: SessionCurrencyMetricsService,
    readonly signupSource: SignupSourceMetricsService,
    readonly game: GameMetricsService,
    readonly dataExport: DataExportMetricsService,
    readonly bookingRetention: BookingRetentionMetricsService,
    readonly introLeads: IntroLeadMetricsService,
    readonly therapyNudge: TherapyNudgeMetricsService,
    readonly notifyQueue: NotifyQueueMetricsService,
    readonly therapistExit: TherapistExitMetricsService,
  ) {}

  /** Имена блоков — для сверки с разделами (stats-sections.spec). */
  blockNames(): string[] {
    return statsBlocks(this).map((b) => b.name);
  }

  /** Продуктовые блоки в порядке отчёта (список — stats-report.blocks.ts). */
  private runs(only?: Set<string>) {
    return statsBlocks(this)
      .filter((b) => !only || only.has(b.name))
      .map((b) => ({ name: b.name, run: () => b.svc.render() }));
  }

  /** Полный отчёт (`/stats all`, perf, live-спек). */
  async render(): Promise<string> {
    const parts = await settleBlocks(
      [...this.runs(), ...infraBlocks()],
      this.logger,
    );
    return parts.join('\n\n');
  }

  /** Раздел /stats: заголовок + его продуктовые блоки. Инфра-блоки и запас
   * фраз для «system» добавляет stats-messages.ts. */
  async renderSection(id: string): Promise<string> {
    const section = findStatsSection(id);
    if (!section) throw new Error(`Нет раздела /stats «${id}»`);
    const parts = await settleBlocks(
      this.runs(new Set(section.blocks)),
      this.logger,
    );
    return [`<b>${section.title}</b>`, ...parts].join('\n\n');
  }
}

import { Injectable } from '@nestjs/common';
import { ProductMetricsService } from './bot.product-metrics.service';
import { ModeCardMetricsService } from './mode-card-metrics.service';
import { ModeDiaryMetricsService } from './mode-diary-metrics.service';
import { WarmWordsMetricsService } from './warm-words-metrics.service';
import { PhraseCheckMetricsService } from './phrase-check-metrics.service';
import { AccountLinkMetricsService } from './account-link-metrics.service';
import { SignupSourceMetricsService } from './signup-source-metrics.service';
import { PlusMetricsService } from './plus-metrics.service';
import { WebBannerMetricsService } from './web-banner-metrics.service';
import { SiteInstallMetricsService } from './site-install-metrics.service';
import { ScreenMetricsService } from './screen-metrics.service';
import { ProfilePatternMetricsService } from './profile-pattern-metrics.service';
import { AuthHealthMetricsService } from './auth-health-metrics.service';
import { LoginTicketMetricsService } from './login-ticket-metrics.service';
import { ClientErrorMetricsService } from './client-error-metrics.service';
import { MoneyMetricsService } from './money-metrics.service';
import { GameMetricsService } from './game-metrics.service';
import { DataExportMetricsService } from './data-export-metrics.service';
import { formatCapabilityReport } from './capability-metrics.format';
import { buildCapabilityReport } from '../infra/capability-report';

// Единая склейка второго сообщения /stats (продуктовые метрики + карточки
// режимов + дневник режимов + тёплые слова). Отдельный модуль — правило №10:
// не раздувать ни ProductMetricsService (зафиксирован на 257 строках), ни
// telegram.service.ts (худший файл репозитория, храповик держит его без роста).
@Injectable()
export class StatsReportService {
  constructor(
    private readonly product: ProductMetricsService,
    private readonly modeCard: ModeCardMetricsService,
    private readonly modeDiary: ModeDiaryMetricsService,
    private readonly warmWords: WarmWordsMetricsService,
    private readonly phraseChecks: PhraseCheckMetricsService,
    private readonly accountLink: AccountLinkMetricsService,
    private readonly plus: PlusMetricsService,
    private readonly webBanner: WebBannerMetricsService,
    private readonly siteInstall: SiteInstallMetricsService,
    private readonly screen: ScreenMetricsService,
    private readonly profilePattern: ProfilePatternMetricsService,
    private readonly authHealth: AuthHealthMetricsService,
    private readonly loginTicket: LoginTicketMetricsService,
    private readonly clientErrors: ClientErrorMetricsService,
    private readonly money: MoneyMetricsService,
    private readonly signupSource: SignupSourceMetricsService,
    private readonly game: GameMetricsService,
    private readonly dataExport: DataExportMetricsService,
  ) {}

  /** Готовый текстовый блок для второго сообщения /stats. Порядок блоков —
   * порядок в отчёте, менять только осознанно (см. тест этого сервиса). */
  async render(): Promise<string> {
    const blocks = [
      this.product,
      this.modeCard,
      this.modeDiary,
      this.warmWords,
      this.phraseChecks,
      this.accountLink,
      this.plus,
      this.webBanner,
      this.siteInstall,
      this.screen,
      this.profilePattern,
      this.authHealth,
      this.loginTicket,
      this.clientErrors,
      this.money,
      this.signupSource,
      this.game,
      this.dataExport,
    ];
    const parts = await Promise.all(blocks.map((b) => b.render()));
    parts.push(formatCapabilityReport(buildCapabilityReport()));
    return parts.join('\n\n');
  }
}

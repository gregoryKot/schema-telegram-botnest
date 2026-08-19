import { Injectable } from '@nestjs/common';
import { ProductMetricsService } from './bot.product-metrics.service';
import { ModeCardMetricsService } from './mode-card-metrics.service';
import { ModeDiaryMetricsService } from './mode-diary-metrics.service';
import { WarmWordsMetricsService } from './warm-words-metrics.service';
import { PhraseCheckMetricsService } from './phrase-check-metrics.service';
import { AccountLinkMetricsService } from './account-link-metrics.service';
import { SignupSourceMetricsService } from './signup-source-metrics.service';
import { PlusMetricsService } from './plus-metrics.service';
import { ScreenMetricsService } from './screen-metrics.service';
import { ProfilePatternMetricsService } from './profile-pattern-metrics.service';
import { AuthHealthMetricsService } from './auth-health-metrics.service';
import { ClientErrorMetricsService } from './client-error-metrics.service';
import { MoneyMetricsService } from './money-metrics.service';
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
    private readonly screen: ScreenMetricsService,
    private readonly profilePattern: ProfilePatternMetricsService,
    private readonly authHealth: AuthHealthMetricsService,
    private readonly clientErrors: ClientErrorMetricsService,
    private readonly money: MoneyMetricsService,
    private readonly signupSource: SignupSourceMetricsService,
  ) {}

  /** Готовый текстовый блок для второго сообщения /stats. */
  async render(): Promise<string> {
    const [
      product,
      modeCard,
      modeDiary,
      warmWords,
      phraseChecks,
      accountLink,
      plus,
      screen,
      profilePattern,
      authHealth,
      clientErrors,
      money,
      signupSource,
    ] = await Promise.all([
      this.product.render(),
      this.modeCard.render(),
      this.modeDiary.render(),
      this.warmWords.render(),
      this.phraseChecks.render(),
      this.accountLink.render(),
      this.plus.render(),
      this.screen.render(),
      this.profilePattern.render(),
      this.authHealth.render(),
      this.clientErrors.render(),
      this.money.render(),
      this.signupSource.render(),
    ]);
    const capability = formatCapabilityReport(buildCapabilityReport());
    return `${product}\n\n${modeCard}\n\n${modeDiary}\n\n${warmWords}\n\n${phraseChecks}\n\n${accountLink}\n\n${plus}\n\n${screen}\n\n${profilePattern}\n\n${authHealth}\n\n${clientErrors}\n\n${money}\n\n${signupSource}\n\n${capability}`;
  }
}

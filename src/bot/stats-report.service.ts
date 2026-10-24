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
import { TherapistExitMetricsService } from './therapist-exit-metrics.service';
import { infraBlocks } from './stats-infra-blocks';
import { settleBlocks } from './stats-settle';

// Склейка второго сообщения /stats (блоки метрик + здоровье системы), отдельный модуль (№10).
// Блоки независимы (stats-settle.ts): упавший заменяется строкой, отчёт не гаснет.
@Injectable()
export class StatsReportService {
  private readonly logger = new Logger(StatsReportService.name);

  constructor(
    private readonly product: ProductMetricsService,
    private readonly modeCard: ModeCardMetricsService,
    private readonly modeDiary: ModeDiaryMetricsService,
    private readonly warmWords: WarmWordsMetricsService,
    private readonly phraseChecks: PhraseCheckMetricsService,
    private readonly entryDelete: EntryDeleteMetricsService,
    private readonly accountLink: AccountLinkMetricsService,
    private readonly plus: PlusMetricsService,
    private readonly webBanner: WebBannerMetricsService,
    private readonly siteInstall: SiteInstallMetricsService,
    private readonly screen: ScreenMetricsService,
    private readonly profilePattern: ProfilePatternMetricsService,
    private readonly conceptGraph: ConceptGraphMetricsService,
    private readonly authHealth: AuthHealthMetricsService,
    private readonly loginTicket: LoginTicketMetricsService,
    private readonly clientErrors: ClientErrorMetricsService,
    private readonly money: MoneyMetricsService,
    private readonly sessionCurrency: SessionCurrencyMetricsService,
    private readonly signupSource: SignupSourceMetricsService,
    private readonly game: GameMetricsService,
    private readonly dataExport: DataExportMetricsService,
    private readonly bookingRetention: BookingRetentionMetricsService,
    private readonly introLeads: IntroLeadMetricsService,
    private readonly notifyQueue: NotifyQueueMetricsService,
    private readonly therapistExit: TherapistExitMetricsService,
  ) {}

  /** Второе сообщение /stats; порядок блоков — порядок в отчёте (см. тест). */
  async render(): Promise<string> {
    const blocks = [
      { name: 'Как пользуются продуктом', svc: this.product },
      { name: 'Карточки режимов', svc: this.modeCard },
      { name: 'Дневник режимов', svc: this.modeDiary },
      { name: 'Тёплые слова', svc: this.warmWords },
      { name: 'Разбор фразы: критик или забота', svc: this.phraseChecks },
      { name: 'Удаление своих записей', svc: this.entryDelete },
      { name: 'Перенос данных из другого приложения', svc: this.accountLink },
      { name: 'Кнопка плюс', svc: this.plus },
      { name: 'Баннеры-переходы', svc: this.webBanner },
      { name: 'Установка с сайта', svc: this.siteInstall },
      { name: 'Настройка экранов', svc: this.screen },
      { name: 'Паттерны со вкладки Я', svc: this.profilePattern },
      { name: 'Графическая концептуализация', svc: this.conceptGraph },
      { name: 'Вход в мессенджере', svc: this.authHealth },
      { name: 'Вход по коду', svc: this.loginTicket },
      { name: 'Поломки на клиенте', svc: this.clientErrors },
      { name: 'Напоминания из бота', svc: this.notifyQueue },
      { name: 'Деньги', svc: this.money },
      { name: 'Сессии не в рублях', svc: this.sessionCurrency },
      { name: 'Откуда пришли новенькие', svc: this.signupSource },
      { name: 'Игра', svc: this.game },
      { name: 'Забирают свои данные', svc: this.dataExport },
      { name: 'Данные записей', svc: this.bookingRetention },
      { name: 'Заявки с формы знакомства', svc: this.introLeads },
      { name: 'Терапевты уходят', svc: this.therapistExit },
    ];
    const runs = blocks.map((b) => ({ ...b, run: () => b.svc.render() }));
    const parts = await settleBlocks([...runs, ...infraBlocks()], this.logger);
    return parts.join('\n\n');
  }
}

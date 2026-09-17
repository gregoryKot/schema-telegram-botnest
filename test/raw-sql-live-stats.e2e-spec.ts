// Весь отчёт /stats на РЕАЛЬНОМ Postgres. Двадцать сервисов метрик написаны
// сырым SQL ($queryRaw), и до 2026-09-13 каждый из них проверялся только
// моком, который отвечает что угодно. Инцидент того дня (бронирование:
// `pg_advisory_xact_lock` возвращает void, Prisma 7 с driver-adapter не
// читает такую колонку — 12 зелёных юнитов, 500 у каждого клиента) показал,
// что свойство драйвера доказывается только живой базой. Здесь исполняется
// ровно то, что делает команда /stats (telegram.admin.service.ts): core-отчёт
// BotAdminStatsService + StatsReportService.render() — дважды: на базе как
// есть (пустое состояние, правило №8: без «NaN/undefined») и после фикстур,
// чтобы ветки группировки по meta реально прошли через драйвер.
import { PrismaService } from '../src/prisma/prisma.service';
import { BotAdminStatsService } from '../src/bot/bot.admin-stats.service';
import { StatsReportService } from '../src/bot/stats-report.service';
import { ProductMetricsService } from '../src/bot/bot.product-metrics.service';
import { QuizMetricsService } from '../src/bot/quiz-metrics.service';
import { PracticeLinkMetricsService } from '../src/bot/practice-link-metrics.service';
import { PracticeMetricsService } from '../src/bot/practice-metrics.service';
import { CaseMetricsService } from '../src/bot/case-metrics.service';
import { ModeCardMetricsService } from '../src/bot/mode-card-metrics.service';
import { ModeDiaryMetricsService } from '../src/bot/mode-diary-metrics.service';
import { WarmWordsMetricsService } from '../src/bot/warm-words-metrics.service';
import { PhraseCheckMetricsService } from '../src/bot/phrase-check-metrics.service';
import { EntryDeleteMetricsService } from '../src/bot/entry-delete-metrics.service';
import { AccountLinkMetricsService } from '../src/bot/account-link-metrics.service';
import { PlusMetricsService } from '../src/bot/plus-metrics.service';
import { WebBannerMetricsService } from '../src/bot/web-banner-metrics.service';
import { SiteInstallMetricsService } from '../src/bot/site-install-metrics.service';
import { ScreenMetricsService } from '../src/bot/screen-metrics.service';
import { ProfilePatternMetricsService } from '../src/bot/profile-pattern-metrics.service';
import { AuthHealthMetricsService } from '../src/bot/auth-health-metrics.service';
import { LoginTicketMetricsService } from '../src/bot/login-ticket-metrics.service';
import { ClientErrorMetricsService } from '../src/bot/client-error-metrics.service';
import { MoneyMetricsService } from '../src/bot/money-metrics.service';
import { SignupSourceMetricsService } from '../src/bot/signup-source-metrics.service';
import { GameMetricsService } from '../src/bot/game-metrics.service';
import { DataExportMetricsService } from '../src/bot/data-export-metrics.service';

const USER_ID = 999_000_000_010n;
// Маркер в meta анонимных событий (userId = null) — по нему спек чистит за
// собой; лишний ключ метрикам не мешает: они читают только свои поля.
const MARK = 'raw-sql-live';

function buildReport(prisma: PrismaService): StatsReportService {
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
    new AuthHealthMetricsService(prisma),
    new LoginTicketMetricsService(prisma),
    new ClientErrorMetricsService(prisma),
    new MoneyMetricsService(prisma),
    new SignupSourceMetricsService(prisma),
    new GameMetricsService(prisma),
    new DataExportMetricsService(prisma),
  );
}

/** Отчёт обязан быть текстом для человека: без следов сломанной арифметики. */
function expectSaneReport(text: string): void {
  expect(text.length).toBeGreaterThan(50);
  expect(text).not.toMatch(/NaN|undefined|\[object Object\]|null/);
}

// События с userId — по одному на каждую ветку метрик пользователя; meta —
// в форме, которую пишет AnalyticsController.sanitizeMeta (без PII).
const USER_EVENTS: Array<{ name: string; meta?: Record<string, unknown> }> = [
  { name: 'share_card', meta: { kind: 'need' } },
  { name: 'crisis_card_shown', meta: { via: 'diary' } },
  { name: 'outbox_flush', meta: { ok: 'true', recovered: 1 } },
  { name: 'onboarding_step', meta: { step: 'needs' } },
  { name: 'today_block_toggle', meta: { block: 'needs' } },
  { name: 'breath_start' },
  { name: 'quiz_started', meta: { quiz: 'schemas', src: 'web' } },
  { name: 'quiz_completed', meta: { quiz: 'schemas', src: 'web' } },
  { name: 'practice_link_click', meta: { target: 'article' } },
  { name: 'mode_card_saved', meta: { modeId: 'vulnerable_child' } },
  { name: 'mode_entry_saved', meta: { modeId: 'vulnerable_child' } },
  { name: 'mode_test_completed' },
  { name: 'mode_chain_followup' },
  { name: 'mode_doubt_opened' },
  { name: 'warm_words_open' },
  { name: 'account_link_started' },
  { name: 'account_link_confirmed' },
  { name: 'plus_open' },
  { name: 'plus_action', meta: { action: 'breath' } },
  { name: 'quick_action_move', meta: { action: 'breath' } },
  { name: 'web_banner_open', meta: { banner: 'desktop' } },
  { name: 'desktop_app_open', meta: { host: 'web' } },
  { name: 'screen_block_toggle', meta: { screen: 'today', block: 'needs' } },
  { name: 'profile_pattern_open', meta: { pattern: 'abandonment' } },
  { name: 'data_export' },
  { name: 'home_screen_offer', meta: { via: 'banner' } },
  { name: 'entry_deleted', meta: { type: 'belief_check' } },
];
// Серверные/анонимные строки (userId IS NULL) — вход, поломки клиента, лиды.
const ANON_EVENTS: Array<{ name: string; meta: Record<string, unknown> }> = [
  { name: 'auth_rejected', meta: { host: 'telegram', reason: 'empty' } },
  { name: 'auth_success', meta: { host: 'telegram' } },
  { name: 'login_ticket_step', meta: { step: 'issued' } },
  { name: 'client_error', meta: { section: 'booking', source: 'webapp' } },
  { name: 'client_error', meta: { section: 'auth', source: 'miniapp' } },
  { name: 'signup_source', meta: { src: 'web' } },
];

describe('/stats на реальном Postgres: каждый сырой запрос исполняется драйвером', () => {
  let prisma: PrismaService;
  let admin: BotAdminStatsService;
  let report: StatsReportService;

  async function cleanup(): Promise<void> {
    await prisma.analyticsEvent.deleteMany({
      where: {
        OR: [{ userId: USER_ID }, { meta: { path: ['e2e'], equals: MARK } }],
      },
    });
    await prisma.user.deleteMany({ where: { id: USER_ID } });
  }

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    admin = new BotAdminStatsService(prisma);
    report = buildReport(prisma);
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it('база как есть (в CI — пустая): оба сообщения /stats собираются без NaN/undefined', async () => {
    const [core, product] = await Promise.all([
      admin.getAdminStats(),
      report.render(),
    ]);
    expectSaneReport(core);
    expectSaneReport(product);
  });

  it('после фикстур: ветки группировки по meta проходят через драйвер, новая секция booking видна в отчёте', async () => {
    await prisma.user.create({ data: { id: USER_ID } });
    await prisma.analyticsEvent.createMany({
      data: [
        ...USER_EVENTS.map((e) => ({
          userId: USER_ID,
          name: e.name,
          meta: { ...(e.meta ?? {}), e2e: MARK },
        })),
        ...ANON_EVENTS.map((e) => ({
          userId: null,
          name: e.name,
          meta: { ...e.meta, e2e: MARK },
        })),
      ],
    });

    const [core, product] = await Promise.all([
      admin.getAdminStats(),
      report.render(),
    ]);
    expectSaneReport(core);
    expectSaneReport(product);
    // Секция 'booking' события client_error (инцидент 2026-09-13) считается
    // отдельным FILTER'ом в сыром SQL — на живой базе он обязан дать ≥1.
    expect(product).toContain('Запись на консультацию');
  });

  it('повторный прогон на той же базе — идемпотентен (фикстуры вычищены)', async () => {
    await cleanup();
    const rows = await prisma.analyticsEvent.count({
      where: { meta: { path: ['e2e'], equals: MARK } },
    });
    expect(rows).toBe(0);
  });
});

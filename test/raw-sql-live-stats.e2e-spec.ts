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
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaService } from '../src/prisma/prisma.service';
import { BotAdminStatsService } from '../src/bot/bot.admin-stats.service';
import { StatsReportService } from '../src/bot/stats-report.service';
import { BLOCK_FAILED_MARK } from '../src/bot/stats-settle';
import { buildStatsReport } from './e2e-support/stats-report.factory';

const USER_ID = 999_000_000_010n;
// Пользователи у границ когорт D1 (±5 ч). Диапазон 21..25 свободен: 011 занят
// USER_ID соседнего raw-sql-live-infra (оба спека идут одним шагом джобы
// migrations, общая база), 001/002 — read-after-write.
const EDGE_IDS = [21n, 22n, 23n, 24n, 25n].map((i) => 999_000_000_000n + i);
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
// Маркер в meta анонимных событий (userId = null) — по нему спек чистит за
// собой; лишний ключ метрикам не мешает: они читают только свои поля.
const MARK = 'raw-sql-live';

/** Отчёт обязан быть текстом для человека: без следов сломанной арифметики. */
function expectSaneReport(text: string): void {
  expect(text.length).toBeGreaterThan(50);
  expect(text).not.toMatch(/NaN|undefined|\[object Object\]|null/);
  // /stats переживает упавший блок (stats-settle.ts), подставляя заглушку, —
  // поэтому битый SQL больше не бросает из render() и без этой проверки
  // живой спек позеленел бы на сломанном запросе (правило №18).
  expect(text).not.toContain(BLOCK_FAILED_MARK);
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
  // Графическая концептуализация: блок считает count/groupBy через Prisma
  // (не сырой SQL), но исполняется драйвером тем же прогоном.
  { name: 'concept_graph_open' },
  { name: 'concept_mode_linked' },
  { name: 'concept_schema_linked' },
  { name: 'concept_canvas_open' },
  { name: 'concept_graph_fullscreen' },
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
  // Шквал (находка аудита 2026-10-11): meta.suppressed суммируется приведением
  // ::int, meta.unlogged считается FILTER'ом — оба идут через драйвер.
  {
    name: 'client_error',
    meta: { section: 'diary', source: 'webapp', suppressed: 3 },
  },
  {
    name: 'client_error',
    meta: { section: 'diary', source: 'webapp', unlogged: true },
  },
  { name: 'signup_source', meta: { src: 'web' } },
  // Кризисная карточка формы записи на визитке (аудит 2026-10, frontends#5):
  // пишется анонимно, строка отчёта считает её отдельно по meta.surface.
  { name: 'crisis_card_shown', meta: { surface: 'booking' } },
  { name: 'crisis_hotline_tapped', meta: { surface: 'booking' } },
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
    await prisma.user.deleteMany({
      where: { id: { in: [USER_ID, ...EDGE_IDS] } },
    });
  }

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    admin = new BotAdminStatsService(prisma);
    report = buildStatsReport(prisma);
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
    // Пустое состояние (правило №8): без шквала строк про него нет.
    expect(product).not.toContain('Повторные отчёты с одного устройства');
    expect(product).not.toContain(
      'Подробности не записаны из-за общего потолка',
    );
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
    // Сумма meta.suppressed и счёт meta.unlogged: сырой SQL приводит jsonb-текст
    // к int на живой базе (мок $queryRaw этого не доказывает, правило №18).
    expect(product).toMatch(
      /Повторные отчёты с одного устройства: ([3-9]|\d{2,}) за неделю/,
    );
    expect(product).toMatch(
      /Подробности не записаны из-за общего потолка: [1-9]\d* —/,
    );
    // groupBy по userId (distinct-терапевты) исполнен драйвером и увидел фикстуры.
    expect(product).toMatch(/Открывали [1-9]\d* раз, терапевтов: [1-9]\d*/);
    expect(product).toMatch(/Связи режимов заполняли [1-9]\d* раз/);
    expect(product).toMatch(/Убеждения и опыт схем записывали [1-9]\d* раз/);
    // JSON-фильтр по meta.surface (countCrisis) исполнен драйвером и увидел
    // анонимные строки: обе цифры «из них в форме записи» не меньше 1.
    expect(product).toMatch(
      /в форме записи на консультацию: показали [1-9]\d*, позвонили [1-9]\d*\)/,
    );
  });

  // Аудит 2026-10: createdAt — timestamp без зоны, а `now()` в SQL когорт
  // брался в зоне сессии. Свойство «Date-параметр не сдвигается зоной» —
  // свойство Postgres и адаптера pg, не нашего кода (правило №18), поэтому
  // второй клиент живёт в зоне Sydney по-настоящему (startup-параметр
  // соединения, а не SET на одном коннекте пула).
  describe('когорты не зависят от TimeZone сессии', () => {
    let sydney: PrismaClient;

    beforeAll(async () => {
      sydney = new PrismaClient({
        adapter: new PrismaPg({
          connectionString: process.env.DATABASE_URL ?? '',
          options: '-c TimeZone=Australia/Sydney',
        }),
      });
      await sydney.$connect();
    });

    afterAll(async () => {
      await sydney.$disconnect();
    });

    it('предусловие: второй клиент действительно сидит в Australia/Sydney', async () => {
      const [{ TimeZone: tz }] = await sydney.$queryRaw<
        Array<{ TimeZone: string }>
      >`SHOW TimeZone`;
      expect(tz).toBe('Australia/Sydney');
    });

    it('D1 одинаков в UTC и в Sydney, граница сдвигается ровно на фикстуры', async () => {
      const adminSydney = new BotAdminStatsService(sydney as PrismaService);
      const before = (await admin.getRetentionStats()).d1.cohort;

      // Окно D1 — [now-8д, now-1д). Внутри: [0] now-1д-5ч и [2] now-8д+5ч;
      // снаружи: [1] now-1д+5ч, [3] now-1д+6ч и [4] now-8д-5ч. Снаружи у
      // верхней границы две, а не одна: сдвиг зоны (-10/-11 ч) у прежнего
      // предиката выносит их внутрь, а [2] наружу — счёт расходится (3 вместо
      // 2), а не совпадает по случайности.
      const now = Date.now();
      const at = (ms: number) => new Date(now + ms);
      await prisma.user.createMany({
        data: [
          { id: EDGE_IDS[0], createdAt: at(-DAY - 5 * HOUR) },
          { id: EDGE_IDS[1], createdAt: at(-DAY + 5 * HOUR) },
          { id: EDGE_IDS[2], createdAt: at(-8 * DAY + 5 * HOUR) },
          { id: EDGE_IDS[3], createdAt: at(-DAY + 6 * HOUR) },
          { id: EDGE_IDS[4], createdAt: at(-8 * DAY - 5 * HOUR) },
        ],
      });

      const utc = (await admin.getRetentionStats()).d1.cohort;
      const syd = (await adminSydney.getRetentionStats()).d1.cohort;
      expect(utc - before).toBe(2);
      expect(syd).toBe(utc);

      // Контрольный образец (правило №15 п.2): прежний предикат с now() в
      // зоне Sydney (+10/+11) считает членство по-другому — значит, фикстуры
      // стоят на границе, а тест умеет краснеть. Сравниваем состав, а не
      // число: сдвиг выносит одну фикстуру внутрь и одну наружу, и счёт
      // совпал бы случайно.
      const legacyIds = (
        await sydney.$queryRaw<Array<{ id: bigint }>>`
          SELECT u.id FROM "User" u
          WHERE u."createdAt" >= now() - make_interval(days => ${8})
            AND u."createdAt" <  now() - make_interval(days => ${1})
            AND u.id = ANY(${EDGE_IDS})
          ORDER BY u.id
        `
      ).map((r) => r.id);
      expect(legacyIds).toHaveLength(3);
      expect(legacyIds).not.toContain(EDGE_IDS[2]);
    });

    it('весь /stats под Sydney собирается без NaN/undefined', async () => {
      const core = await new BotAdminStatsService(
        sydney as PrismaService,
      ).getAdminStats();
      const product = await buildStatsReport(sydney as PrismaService).render();
      expectSaneReport(core);
      expectSaneReport(product);
    });
  });

  it('повторный прогон на той же базе — идемпотентен (фикстуры вычищены)', async () => {
    await cleanup();
    const rows = await prisma.analyticsEvent.count({
      where: { meta: { path: ['e2e'], equals: MARK } },
    });
    expect(rows).toBe(0);
  });
});

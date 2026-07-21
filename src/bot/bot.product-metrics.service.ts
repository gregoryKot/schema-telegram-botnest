import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { formatProductMetrics, ProductMetrics } from './product-metrics.format';
import {
  ONBOARDING_STEPS,
  TODAY_BLOCKS,
} from '../analytics/analytics.constants';

// Продуктовые метрики для /stats (правило №8). Всё выводится из БД: часть — из
// таблиц-фич (онбординг/adoption/распределения), часть — из событий
// AnalyticsEvent (кризис/шэр/офлайн). Один сервис = запросы, форматтер отдельно
// (product-metrics.format.ts, покрыт тестом).
@Injectable()
export class ProductMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Готовый текстовый блок для /stats. */
  async render(): Promise<string> {
    return formatProductMetrics(await this.getMetrics());
  }

  async getMetrics(): Promise<ProductMetrics> {
    const since7 = new Date(Date.now() - 7 * 86_400_000);
    const since30 = new Date(Date.now() - 30 * 86_400_000);
    const num = (rows: Array<{ c: bigint }>): number => Number(rows[0]?.c ?? 0);
    const activeUser = { deletedAt: null } as const;
    const ev = (name: string) =>
      this.prisma.analyticsEvent.count({
        where: { name, createdAt: { gte: since30 } },
      });

    const [
      cohort30,
      completed30,
      diaries,
      ysqDone,
      exercises,
      practices,
      childhood,
      ysqStarted,
      ty,
      vy,
      notChosen,
      sectionsRaw,
      themeLight,
      themeDark,
      themeSystem,
      crisisShown,
      crisisTapped,
      shareRows,
      outboxRows,
      shareCard7,
      shareCard30,
      shareKindRows,
      todayFocusChanged,
      blocksHiddenRows,
      breathStarted,
      onboardingStepRows,
      customizeRows,
      homeScreenRows,
      journeyOpens,
    ] = await Promise.all([
      this.prisma.user.count({
        where: { ...activeUser, createdAt: { gte: since30 } },
      }),
      this.prisma.user.count({
        where: {
          ...activeUser,
          createdAt: { gte: since30 },
          onboardingV2Done: true,
        },
      }),
      // Дневники и упражнения — разные люди, объединение таблиц (COUNT DISTINCT).
      this.prisma.$queryRaw<Array<{ c: bigint }>>`
        SELECT count(DISTINCT uid)::bigint AS c FROM (
          SELECT "userId" AS uid FROM "SchemaDiaryEntry"
          UNION SELECT "userId" FROM "ModeDiaryEntry"
          UNION SELECT "userId" FROM "GratitudeDiaryEntry"
        ) t`,
      this.prisma.ysqResult.count(),
      this.prisma.$queryRaw<Array<{ c: bigint }>>`
        SELECT count(DISTINCT uid)::bigint AS c FROM (
          SELECT "userId" AS uid FROM "UserFlashcard"
          UNION SELECT "userId" FROM "UserBeliefCheck"
          UNION SELECT "userId" FROM "UserLetter"
          UNION SELECT "userId" FROM "UserSafePlace"
        ) t`,
      this.prisma.$queryRaw<Array<{ c: bigint }>>`
        SELECT count(DISTINCT "userId")::bigint AS c FROM "UserPractice"`,
      this.prisma.$queryRaw<Array<{ c: bigint }>>`
        SELECT count(DISTINCT "userId")::bigint AS c FROM "ChildhoodRating"`,
      this.prisma.ysqProgress.count(),
      this.prisma.user.count({ where: { ...activeUser, addressForm: 'ty' } }),
      this.prisma.user.count({ where: { ...activeUser, addressForm: 'vy' } }),
      this.prisma.user.count({ where: { ...activeUser, addressForm: null } }),
      this.prisma.user.groupBy({
        by: ['defaultSection'],
        where: { ...activeUser, defaultSection: { not: null } },
        _count: { _all: true },
      }),
      this.prisma.user.count({ where: { ...activeUser, themePref: 'light' } }),
      this.prisma.user.count({ where: { ...activeUser, themePref: 'dark' } }),
      this.prisma.user.count({ where: { ...activeUser, themePref: null } }),
      ev('crisis_card_shown'),
      ev('crisis_hotline_tapped'),
      this.prisma.$queryRaw<Array<{ ok: string | null; c: bigint }>>`
        SELECT "meta"->>'ok' AS ok, count(*)::bigint AS c FROM "AnalyticsEvent"
        WHERE "name" = 'share_result' AND "createdAt" >= ${since30}
        GROUP BY "meta"->>'ok'`,
      this.prisma.$queryRaw<Array<{ flushes: bigint; recovered: bigint }>>`
        SELECT count(*)::bigint AS flushes,
               COALESCE(SUM(("meta"->>'count')::int), 0)::bigint AS recovered
        FROM "AnalyticsEvent"
        WHERE "name" = 'outbox_flush' AND "createdAt" >= ${since30}`,
      this.prisma.analyticsEvent.count({
        where: { name: 'share_card', createdAt: { gte: since7 } },
      }),
      this.prisma.analyticsEvent.count({
        where: { name: 'share_card', createdAt: { gte: since30 } },
      }),
      this.prisma.$queryRaw<Array<{ kind: string | null; c: bigint }>>`
        SELECT "meta"->>'kind' AS kind, count(*)::bigint AS c
        FROM "AnalyticsEvent"
        WHERE "name" = 'share_card' AND "createdAt" >= ${since30}
        GROUP BY "meta"->>'kind'
        ORDER BY c DESC`,
      ev('today_focus_change'),
      // Скрытия блоков главного. Старое событие today_streak_toggle (до того,
      // как блоков стало несколько) подмешиваем как блок 'streak' — иначе
      // накопленная история молча обнулится в отчёте.
      this.prisma.$queryRaw<Array<{ block: string | null; c: bigint }>>`
        SELECT block, SUM(c)::bigint AS c FROM (
          SELECT "meta"->>'block' AS block, count(*)::bigint AS c
            FROM "AnalyticsEvent"
           WHERE "name" = 'today_block_toggle' AND "meta"->>'hidden' = 'true'
             AND "createdAt" >= ${since30}
           GROUP BY "meta"->>'block'
          UNION ALL
          SELECT 'streak' AS block, count(*)::bigint AS c
            FROM "AnalyticsEvent"
           WHERE "name" = 'today_streak_toggle' AND "meta"->>'hidden' = 'true'
             AND "createdAt" >= ${since30}
        ) t GROUP BY block`,
      ev('breath_start'),
      // Воронка обучения: люди (не события) на каждом шаге — один человек мог
      // вернуться к шагу точками навигации, это не должно раздувать счёт.
      this.prisma.$queryRaw<Array<{ step: string | null; c: bigint }>>`
        SELECT "meta"->>'step' AS step, count(DISTINCT "userId")::bigint AS c
        FROM "AnalyticsEvent"
        WHERE "name" = 'onboarding_step' AND "createdAt" >= ${since30}
        GROUP BY "meta"->>'step'`,
      this.prisma.$queryRaw<Array<{ via: string | null; c: bigint }>>`
        SELECT "meta"->>'via' AS via, count(*)::bigint AS c
        FROM "AnalyticsEvent"
        WHERE "name" = 'today_customize_open' AND "createdAt" >= ${since30}
        GROUP BY "meta"->>'via'`,
      this.prisma.$queryRaw<Array<{ action: string | null; c: bigint }>>`
        SELECT "meta"->>'action' AS action, count(*)::bigint AS c
        FROM "AnalyticsEvent"
        WHERE "name" = 'home_screen_offer' AND "createdAt" >= ${since30}
        GROUP BY "meta"->>'action'`,
      ev('journey_open'),
    ]);

    const sections = sectionsRaw
      .map((r) => ({
        key: r.defaultSection ?? 'другое',
        count: r._count._all,
      }))
      .sort((a, b) => b.count - a.count);

    const shareOk = Number(shareRows.find((r) => r.ok === 'true')?.c ?? 0n);
    const shareFallback = Number(
      shareRows.find((r) => r.ok === 'false')?.c ?? 0n,
    );

    const blockCounts = new Map(
      blocksHiddenRows.map((r) => [r.block ?? '', Number(r.c)]),
    );
    const hsCount = (action: string): number =>
      Number(homeScreenRows.find((r) => r.action === action)?.c ?? 0n);
    const viaCount = (via: string): number =>
      Number(customizeRows.find((r) => r.via === via)?.c ?? 0n);

    // Порядок — как в онбординге (ONBOARDING_STEPS), а не по убыванию счёта:
    // воронка читается сверху вниз, видно, на каком шаге обрыв.
    const stepCounts = new Map(
      onboardingStepRows.map((r) => [r.step ?? '', Number(r.c)]),
    );
    const onboardingSteps = ONBOARDING_STEPS.filter((s) =>
      stepCounts.has(s),
    ).map((step) => ({ step, count: stepCounts.get(step) ?? 0 }));

    return {
      onboarding: { cohort30, completed30 },
      onboardingSteps,
      adoption: {
        diaries: num(diaries),
        ysqDone,
        exercises: num(exercises),
        practices: num(practices),
        childhood: num(childhood),
      },
      ysq: { started: ysqStarted, completed: ysqDone },
      addressForm: { ty, vy, notChosen },
      sections,
      themes: { light: themeLight, dark: themeDark, system: themeSystem },
      shareCard: {
        total7: shareCard7,
        total30: shareCard30,
        byKind30: shareKindRows.map((r) => ({
          kind: r.kind ?? 'другое',
          count: Number(r.c),
        })),
      },
      crisis: { shown: crisisShown, hotlineTapped: crisisTapped },
      shareResult: { ok: shareOk, fallback: shareFallback },
      outbox: {
        flushes: Number(outboxRows[0]?.flushes ?? 0n),
        recovered: Number(outboxRows[0]?.recovered ?? 0n),
      },
      today: {
        focusChanged: todayFocusChanged,
        // Порядок — как в листе настройки, а не по убыванию счёта.
        blocksHidden: TODAY_BLOCKS.filter((b) => blockCounts.has(b)).map(
          (block) => ({ block, count: blockCounts.get(block) ?? 0 }),
        ),
        customizeGear: viaCount('gear'),
        customizeLongpress: viaCount('longpress'),
      },
      breath: { started: breathStarted },
      journey: { opens: journeyOpens },
      homeScreen: {
        shown: hsCount('shown'),
        add: hsCount('add'),
        later: hsCount('later'),
        never: hsCount('never'),
        added: hsCount('added'),
      },
    };
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ScreenMetrics, formatScreenMetrics } from './screen-metrics.format';

// Счётчики настройки экранов «Профиль»/«Паттерны» для /stats: события
// screen_customize_open/screen_block_toggle из AnalyticsEvent. Свой домен —
// свой файл (правило №10), образец GROUP BY meta — plus-metrics.service.ts.
@Injectable()
export class ScreenMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Готовый текстовый блок для /stats. */
  async render(): Promise<string> {
    return formatScreenMetrics(await this.getMetrics());
  }

  async getMetrics(): Promise<ScreenMetrics> {
    const since30 = new Date(Date.now() - 30 * 86_400_000);
    const [opensRows, hiddenRows, movesRows, syncedRows] = await Promise.all([
      this.prisma.$queryRaw<Array<{ screen: string | null; c: bigint }>>`
        SELECT "meta"->>'screen' AS screen, count(*)::bigint AS c
        FROM "AnalyticsEvent"
        WHERE "name" = 'screen_customize_open' AND "createdAt" >= ${since30}
        GROUP BY "meta"->>'screen'`,
      // Что прячут: screen_block_toggle с hidden=true, по паре (экран, блок).
      this.prisma.$queryRaw<
        Array<{ screen: string | null; block: string | null; c: bigint }>
      >`
        SELECT "meta"->>'screen' AS screen, "meta"->>'block' AS block,
               count(*)::bigint AS c
        FROM "AnalyticsEvent"
        WHERE "name" = 'screen_block_toggle'
          AND "meta"->>'hidden' = 'true'
          AND "createdAt" >= ${since30}
        GROUP BY "meta"->>'screen', "meta"->>'block'
        ORDER BY c DESC`,
      // Переставляли блоки местами — без разбивки по экрану/блоку, только
      // общий счётчик (тот же приём, что и moves30 в plus-metrics.service.ts).
      this.prisma.$queryRaw<Array<{ moves: bigint }>>`
        SELECT count(*)::bigint AS moves
        FROM "AnalyticsEvent"
        WHERE "name" = 'screen_block_move' AND "createdAt" >= ${since30}`,
      // Сколько юзеров хоть раз сохранили серверное зеркало настроек
      // (User.uiPrefs) — не за 30 дней, а всего (это состояние, не событие).
      this.prisma.$queryRaw<Array<{ c: bigint }>>`
        SELECT count(*)::bigint AS c FROM "User" WHERE "uiPrefs" IS NOT NULL`,
    ]);
    const [moveRow] = movesRows;
    return {
      opensByScreen: opensRows
        .filter((r): r is { screen: string; c: bigint } => r.screen != null)
        .map((r) => ({ screen: r.screen, count: Number(r.c) })),
      hiddenByScreenBlock: hiddenRows
        .filter(
          (r): r is { screen: string; block: string; c: bigint } =>
            r.screen != null && r.block != null,
        )
        .map((r) => ({
          screen: r.screen,
          block: r.block,
          count: Number(r.c),
        })),
      moves30: Number(moveRow?.moves ?? 0n),
      syncedUsers: Number(syncedRows[0]?.c ?? 0n),
    };
  }
}

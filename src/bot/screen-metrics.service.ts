import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  ScreenMetrics,
  formatScreenMetrics,
  isShownScreen as live,
} from './screen-metrics.format';
import { countHomeMetrics } from './home-tiles.count';

// Настройка экранов «Профиль»/«Паттерны» для /stats: screen_customize_open,
// screen_block_toggle, screen_block_move из AnalyticsEvent (правило №10).
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
      // Переставляли блоки местами — по экрану (правило №8: перестановки
      // «Сегодня» не должны утонуть в общем счётчике с «Профилем»/«Паттернами»).
      this.prisma.$queryRaw<Array<{ screen: string | null; c: bigint }>>`
        SELECT "meta"->>'screen' AS screen, count(*)::bigint AS c
        FROM "AnalyticsEvent"
        WHERE "name" = 'screen_block_move' AND "createdAt" >= ${since30}
        GROUP BY "meta"->>'screen'`,
      // Сколько юзеров хоть раз сохранили серверное зеркало настроек
      // (User.uiPrefs) — не за 30 дней, а всего (это состояние, не событие).
      this.prisma.$queryRaw<Array<{ c: bigint }>>`
        SELECT count(*)::bigint AS c FROM "User" WHERE "uiPrefs" IS NOT NULL`,
    ]);
    return {
      ...(await countHomeMetrics(this.prisma, since30)),
      opensByScreen: opensRows
        .filter(live)
        .map((r) => ({ screen: r.screen, count: Number(r.c) })),
      hiddenByScreenBlock: hiddenRows
        .filter(live)
        .filter((r): r is typeof r & { block: string } => r.block != null)
        .map((r) => ({
          screen: r.screen,
          block: r.block,
          count: Number(r.c),
        })),
      movesByScreen: movesRows
        .filter(live)
        .map((r) => ({ screen: r.screen, count: Number(r.c) })),
      syncedUsers: Number(syncedRows[0]?.c ?? 0n),
    };
  }
}

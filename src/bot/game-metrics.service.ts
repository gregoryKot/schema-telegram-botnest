import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GAME_EVENTS } from '../analytics/game-events.constants';
import { formatGameMetrics } from './game-metrics.format';
import {
  tallyGameRows,
  type GameEventRow,
  type GameMetrics,
} from './game-metrics.tally';

// Блок «Игра» для /stats: игра (game/) не авторизует пользователя (userId =
// null, правило №5/№14, тот же фильтр, что у auth-health-metrics.service.ts).
@Injectable()
export class GameMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Готовый текстовый блок для /stats. */
  async render(): Promise<string> {
    return formatGameMetrics(await this.getMetrics());
  }

  async getMetrics(): Promise<GameMetrics> {
    const since30 = new Date(Date.now() - 30 * 86_400_000);
    const rows = await this.prisma.$queryRaw<GameEventRow[]>(Prisma.sql`
      SELECT "name", "meta"->>'chapter' AS chapter, "meta"->>'from' AS place,
             "meta"->>'src' AS src, "meta"->>'to' AS target, count(*)::bigint AS c
      FROM "AnalyticsEvent"
      WHERE "name" IN (${Prisma.join(GAME_EVENTS)}) AND "userId" IS NULL
        AND "createdAt" >= ${since30}
      GROUP BY 1, 2, 3, 4, 5`);
    return tallyGameRows(rows);
  }
}

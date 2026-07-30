import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PracticeMetrics } from './practice-metrics.format';

// Счётчики быстрых практик «Здесь и сейчас» для /stats: «запускали»
// (события breath_start/stop_start из AnalyticsEvent — нажал кнопку) и
// «прошли до конца» (таблица PracticeSession — реально дошёл до финала).
// У заземления нет события старта — только «прошли до конца». Запросы
// отдельно от ProductMetricsService — свой домен, свой файл (правило №10,
// образец — quiz-metrics.service.ts).
@Injectable()
export class PracticeMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  async getMetrics(): Promise<PracticeMetrics> {
    const since30 = new Date(Date.now() - 30 * 86_400_000);
    const ev = (name: string) =>
      this.prisma.analyticsEvent.count({
        where: { name, createdAt: { gte: since30 } },
      });

    const [breathStarted, stopStarted, sessionRows, usersRaw] =
      await Promise.all([
        ev('breath_start'),
        ev('stop_start'),
        this.prisma.practiceSession.groupBy({
          by: ['tool'],
          where: { createdAt: { gte: since30 } },
          _count: { _all: true },
        }),
        this.prisma.$queryRaw<Array<{ c: bigint }>>`
          SELECT count(DISTINCT "userId")::bigint AS c FROM "PracticeSession"
          WHERE "createdAt" >= ${since30}`,
      ]);

    const completed = (tool: string): number =>
      sessionRows.find((r) => r.tool === tool)?._count._all ?? 0;

    return {
      breathing: { started: breathStarted, completed: completed('breathing') },
      grounding: { completed: completed('grounding') },
      stop: { started: stopStarted, completed: completed('stop') },
      distinctUsers: Number(usersRaw[0]?.c ?? 0n),
    };
  }
}

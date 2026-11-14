import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QuizMetrics } from './quiz-metrics.format';

// Счётчики мини-тестов для /stats: события quiz_started/quiz_completed из
// AnalyticsEvent (в т.ч. анонимные с сайта, userId = null). Запросы отдельно
// от ProductMetricsService — свой домен, свой файл (правило №10).
@Injectable()
export class QuizMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  async getMetrics(): Promise<QuizMetrics> {
    const since30 = new Date(Date.now() - 30 * 86_400_000);
    const [started30, completed30, byQuizRows] = await Promise.all([
      this.prisma.analyticsEvent.count({
        where: { name: 'quiz_started', createdAt: { gte: since30 } },
      }),
      this.prisma.analyticsEvent.count({
        where: { name: 'quiz_completed', createdAt: { gte: since30 } },
      }),
      this.prisma.$queryRaw<Array<{ quiz: string | null; c: bigint }>>`
        SELECT "meta"->>'quiz' AS quiz, count(*)::bigint AS c
        FROM "AnalyticsEvent"
        WHERE "name" = 'quiz_completed' AND "createdAt" >= ${since30}
        GROUP BY "meta"->>'quiz'
        ORDER BY c DESC`,
    ]);
    return {
      started30,
      completed30,
      byQuiz30: byQuizRows.map((r) => ({
        quiz: r.quiz ?? 'другое',
        count: Number(r.c),
      })),
    };
  }
}

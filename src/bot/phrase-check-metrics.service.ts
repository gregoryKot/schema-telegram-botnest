import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  PhraseCheckMetrics,
  formatPhraseCheckMetrics,
} from './phrase-check-metrics.format';

// Счётчики упражнения «Разобрать фразу» для /stats: считаются по самой таблице
// UserPhraseCheck, а не по событиям — сохранённый разбор и есть факт
// прохождения. Свой домен — свой файл (правило №10), образец —
// warm-words-metrics.service.ts.
@Injectable()
export class PhraseCheckMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Готовый текстовый блок для /stats. */
  async render(): Promise<string> {
    return formatPhraseCheckMetrics(await this.getMetrics());
  }

  async getMetrics(): Promise<PhraseCheckMetrics> {
    const since30 = new Date(Date.now() - 30 * 86_400_000);
    const [totals, markRows] = await Promise.all([
      this.prisma.$queryRaw<
        Array<{ checks: bigint; users: bigint; rewritten: bigint }>
      >`
        SELECT count(*)::bigint AS checks,
               count(DISTINCT "userId")::bigint AS users,
               count(*) FILTER (WHERE "rewrite" IS NOT NULL)::bigint AS rewritten
        FROM "UserPhraseCheck"
        WHERE "createdAt" >= ${since30}`,
      // marks лежит открытым массивом (перечисление), поэтому разбивку
      // считает БД, а не приложение.
      this.prisma.$queryRaw<Array<{ mark: string; c: bigint }>>`
        SELECT mark, count(*)::bigint AS c
        FROM "UserPhraseCheck",
             jsonb_array_elements_text("marks") AS mark
        WHERE "createdAt" >= ${since30}
        GROUP BY mark
        ORDER BY c DESC`,
    ]);
    const row = totals[0];
    return {
      checks30: Number(row?.checks ?? 0n),
      users30: Number(row?.users ?? 0n),
      withRewrite30: Number(row?.rewritten ?? 0n),
      marks30: markRows.map((r) => ({ mark: r.mark, count: Number(r.c) })),
    };
  }
}

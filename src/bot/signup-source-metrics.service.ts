import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SIGNUP_SOURCES } from '../analytics/signup-sources.constants';
import {
  SignupSourceMetrics,
  formatSignupSourceMetrics,
} from './signup-source-metrics.format';

// Счётчики атрибуции посевов для /stats: событие signup_source из
// AnalyticsEvent, сгруппированное по meta.src за 7 и 30 дней. Свой домен —
// свой файл (правило №10), образец — account-link-metrics.service.ts.
@Injectable()
export class SignupSourceMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Готовый текстовый блок для /stats. */
  async render(): Promise<string> {
    return formatSignupSourceMetrics(await this.getMetrics());
  }

  async getMetrics(): Promise<SignupSourceMetrics> {
    const since7 = new Date(Date.now() - 7 * 86_400_000);
    const since30 = new Date(Date.now() - 30 * 86_400_000);
    const rows = await this.prisma.$queryRaw<
      Array<{ src: string | null; c7: bigint; c30: bigint }>
    >`
      SELECT
        "meta"->>'src' AS src,
        count(*) FILTER (WHERE "createdAt" >= ${since7})::bigint AS c7,
        count(*)::bigint AS c30
      FROM "AnalyticsEvent"
      WHERE "name" = 'signup_source' AND "createdAt" >= ${since30}
      GROUP BY "meta"->>'src'`;

    // Сворачиваем в фиксированный набор известных источников — строка с
    // src вне allow-list (историческая запись/рассинхрон) не теряется
    // молча, а падает в 'other', как и на записи (sanitizeMeta/parseSourceSlug).
    const known = new Set<string>(SIGNUP_SOURCES);
    const counts = new Map<string, { c7: number; c30: number }>(
      SIGNUP_SOURCES.map((src) => [src, { c7: 0, c30: 0 }]),
    );
    for (const row of rows) {
      const src = row.src && known.has(row.src) ? row.src : 'other';
      const bucket = counts.get(src)!;
      bucket.c7 += Number(row.c7);
      bucket.c30 += Number(row.c30);
    }

    const bySource = SIGNUP_SOURCES.map((src) => ({
      src,
      count7: counts.get(src)!.c7,
      count30: counts.get(src)!.c30,
    }));
    return {
      total7: bySource.reduce((sum, b) => sum + b.count7, 0),
      total30: bySource.reduce((sum, b) => sum + b.count30, 0),
      bySource,
    };
  }
}

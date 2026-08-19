import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  WebBannerMetrics,
  formatWebBannerMetrics,
} from './web-banner-metrics.format';

// Счётчики баннеров-переходов для /stats: события web_banner_open/
// web_banner_dismiss из AnalyticsEvent, разбивка по meta.banner. Свой домен —
// свой файл (правило №10), образец GROUP BY meta — plus-metrics.service.ts.
@Injectable()
export class WebBannerMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Готовый текстовый блок для /stats. */
  async render(): Promise<string> {
    return formatWebBannerMetrics(await this.getMetrics());
  }

  async getMetrics(): Promise<WebBannerMetrics> {
    const since30 = new Date(Date.now() - 30 * 86_400_000);
    const [opensRows, dismissesRows] = await Promise.all([
      this.prisma.$queryRaw<Array<{ banner: string | null; c: bigint }>>`
        SELECT "meta"->>'banner' AS banner, count(*)::bigint AS c
        FROM "AnalyticsEvent"
        WHERE "name" = 'web_banner_open' AND "createdAt" >= ${since30}
        GROUP BY "meta"->>'banner'
        ORDER BY c DESC`,
      this.prisma.$queryRaw<Array<{ banner: string | null; c: bigint }>>`
        SELECT "meta"->>'banner' AS banner, count(*)::bigint AS c
        FROM "AnalyticsEvent"
        WHERE "name" = 'web_banner_dismiss' AND "createdAt" >= ${since30}
        GROUP BY "meta"->>'banner'
        ORDER BY c DESC`,
    ]);
    const toList = (
      rows: Array<{ banner: string | null; c: bigint }>,
    ): Array<{ banner: string; count: number }> =>
      rows
        .filter((r): r is { banner: string; c: bigint } => r.banner != null)
        .map((r) => ({ banner: r.banner, count: Number(r.c) }));
    return {
      opens30: toList(opensRows),
      dismisses30: toList(dismissesRows),
    };
  }
}

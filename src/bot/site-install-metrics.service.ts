import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SITE_INSTALL_SURFACES } from '../analytics/analytics.constants';
import {
  SiteInstallMetrics,
  formatSiteInstallMetrics,
} from './site-install-metrics.format';

// Счётчики «Установка с сайта» для /stats: home_screen_offer с сайтовых
// surface (SITE_INSTALL_SURFACES), одним запросом сгруппированным по
// surface+action — свой домен, свой файл (правило №10), образец GROUP BY
// meta по двум полям — bot.product-metrics.service.ts (та же таблица,
// дополняющий срез: там воронка мини-аппа явно ИСКЛЮЧАЕТ эти surface).
// Второй, независимый запрос — desktop_app_open (без meta): сколько раз и
// сколько разных userId запускали установленное приложение на компьютере.
@Injectable()
export class SiteInstallMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Готовый текстовый блок для /stats. */
  async render(): Promise<string> {
    return formatSiteInstallMetrics(await this.getMetrics());
  }

  async getMetrics(): Promise<SiteInstallMetrics> {
    const since30 = new Date(Date.now() - 30 * 86_400_000);
    const [rows, desktopRows] = await Promise.all([
      this.prisma.$queryRaw<
        Array<{ surface: string | null; action: string | null; c: bigint }>
      >(Prisma.sql`
        SELECT "meta"->>'surface' AS surface, "meta"->>'action' AS action,
               count(*)::bigint AS c
        FROM "AnalyticsEvent"
        WHERE "name" = 'home_screen_offer'
          AND "meta"->>'surface' IN (${Prisma.join(SITE_INSTALL_SURFACES)})
          AND "createdAt" >= ${since30}
        GROUP BY 1, 2`),
      this.prisma.$queryRaw<Array<{ opens: bigint; users: bigint }>>(Prisma.sql`
        SELECT count(*)::bigint AS opens,
               count(DISTINCT "userId")::bigint AS users
        FROM "AnalyticsEvent"
        WHERE "name" = 'desktop_app_open'
          AND "createdAt" >= ${since30}`),
    ]);

    // NULL/неизвестные surface-action комбинации (мусор из старых версий
    // клиента, будущие расширения) молча игнорируются — счёт не искажается.
    const count = (surface: string, action: string): number =>
      Number(
        rows.find((r) => r.surface === surface && r.action === action)?.c ?? 0n,
      );

    return {
      banner: {
        shown30: count('site_banner', 'shown'),
        add30: count('site_banner', 'add'),
        added30: count('site_banner', 'added'),
      },
      landing: {
        add30: count('site_landing', 'add'),
        added30: count('site_landing', 'added'),
      },
      desktopOpens30: {
        opens: Number(desktopRows[0]?.opens ?? 0n),
        users: Number(desktopRows[0]?.users ?? 0n),
      },
    };
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  ClientErrorMetrics,
  formatClientErrorMetrics,
} from './client-error-metrics.format';
import type { ClientErrorMetricsRow } from './client-error-metrics.row';

// Счётчики поломок клиента для /stats (волна 9 щита покрытия,
// docs/SHIELD_PROMPT.md): событие client_error пишет только
// ClientErrorsController (src/api/client-errors.controller.ts), всегда
// userId = null — тот же приём и тот же повод, что у AuthHealthMetricsService:
// /api/event открыт авторизованным клиентам, и без фильтра "userId IS NULL"
// любой из них мог бы накрутить отчёт своим userId. Свой домен — свой файл
// (правило №10), образец — auth-health-metrics.service.ts.
@Injectable()
export class ClientErrorMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Готовый текстовый блок для /stats. */
  async render(): Promise<string> {
    return formatClientErrorMetrics(await this.getMetrics());
  }

  async getMetrics(): Promise<ClientErrorMetrics> {
    const now = Date.now();
    const since7 = new Date(now - 7 * 86_400_000);
    const since1 = new Date(now - 86_400_000);
    // Один проход FILTER'ами вместо GROUP BY: секций и площадок — известный
    // ограниченный список (CLIENT_ERROR_SECTIONS), раскладывать который по
    // строкам дороже и сложнее тестировать, чем по колонкам (тот же приём,
    // что у account-link-metrics.service.ts).
    // Тип строки — client-error-metrics.row.ts: опечатка в ключе ломает tsc.
    const [row] = await this.prisma.$queryRaw<ClientErrorMetricsRow[]>`
      SELECT
        count(*) FILTER (WHERE "createdAt" >= ${since1})::bigint AS total_day,
        count(*)::bigint AS total_week,
        count(*) FILTER (WHERE meta->>'section' = 'auth'
                           AND "createdAt" >= ${since1})::bigint AS auth_day,
        count(*) FILTER (WHERE meta->>'section' = 'auth')::bigint AS auth_week,
        count(*) FILTER (WHERE meta->>'section' = 'login')::bigint AS login_week,
        count(*) FILTER (WHERE meta->>'section' = 'today')::bigint AS today_week,
        count(*) FILTER (WHERE meta->>'section' = 'diary')::bigint AS diary_week,
        count(*) FILTER (WHERE meta->>'section' = 'schemas')::bigint AS schemas_week,
        count(*) FILTER (WHERE meta->>'section' = 'practice')::bigint AS practice_week,
        count(*) FILTER (WHERE meta->>'section' = 'profile')::bigint AS profile_week,
        count(*) FILTER (WHERE meta->>'section' = 'help')::bigint AS help_week,
        count(*) FILTER (WHERE meta->>'section' = 'cabinet')::bigint AS cabinet_week,
        count(*) FILTER (WHERE meta->>'section' = 'booking')::bigint AS booking_week,
        count(*) FILTER (WHERE meta->>'section' = 'other')::bigint AS other_week,
        count(*) FILTER (WHERE meta->>'source' = 'webapp')::bigint AS webapp_week,
        count(*) FILTER (WHERE meta->>'source' = 'miniapp')::bigint AS miniapp_week,
        COALESCE(sum((meta->>'suppressed')::int), 0)::bigint AS repeats_week,
        count(*) FILTER (WHERE meta->>'unlogged' = 'true')::bigint AS unlogged_week
      FROM "AnalyticsEvent"
      WHERE "userId" IS NULL
        AND "name" = 'client_error'
        AND "createdAt" >= ${since7}`;
    const n = (v: bigint | undefined) => Number(v ?? 0n);
    return {
      totalDay: n(row?.total_day),
      totalWeek: n(row?.total_week),
      authDay: n(row?.auth_day),
      authWeek: n(row?.auth_week),
      bySection: {
        login: n(row?.login_week),
        today: n(row?.today_week),
        diary: n(row?.diary_week),
        schemas: n(row?.schemas_week),
        practice: n(row?.practice_week),
        profile: n(row?.profile_week),
        help: n(row?.help_week),
        cabinet: n(row?.cabinet_week),
        booking: n(row?.booking_week),
        other: n(row?.other_week),
      },
      bySource: {
        webapp: n(row?.webapp_week),
        miniapp: n(row?.miniapp_week),
      },
      repeatsWeek: n(row?.repeats_week),
      unloggedWeek: n(row?.unlogged_week),
    };
  }
}

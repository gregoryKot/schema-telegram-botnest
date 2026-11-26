import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AnalyticsEventName } from '../analytics/analytics.constants';
import { EVENT_RETENTION_DAYS } from '../analytics/analytics-retention';
import {
  ExitTotals,
  TherapistExitMetrics,
  formatTherapistExitMetrics,
} from './therapist-exit-metrics.format';

const DAY_MS = 86_400_000;
const EVENT: AnalyticsEventName = 'therapist_resigned';

type Row = { userId: bigint | null; meta: unknown; createdAt: Date };

/** Число завершённых связей из meta; null — строка не от сервера. */
function clientsEnded(meta: unknown): number | null {
  const v = (meta as { clientsEnded?: unknown } | null)?.clientsEnded;
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : null;
}

function totals(rows: Row[]): ExitTotals {
  const therapists = new Set<string>();
  let clients = 0;
  for (const r of rows) {
    therapists.add(String(r.userId));
    clients += clientsEnded(r.meta) ?? 0;
  }
  return { therapists: therapists.size, clients };
}

// Счётчики для /stats: событие therapist_resigned (терапевт отказался от роли,
// TherapistExitService.resign). Отказы редки — строки читаются целиком, без
// сырого SQL. POST /api/event открыт клиенту, но meta этого события с клиента
// не принимается (ветки в sanitizeMeta нет): строка без числа clientsEnded —
// подделка, в отчёт не идёт. Образец — notify-queue-metrics.service.ts.
@Injectable()
export class TherapistExitMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Готовый текстовый блок для /stats. */
  async render(): Promise<string> {
    return formatTherapistExitMetrics(await this.getMetrics());
  }

  async getMetrics(): Promise<TherapistExitMetrics> {
    const now = Date.now();
    const since30 = new Date(now - 30 * DAY_MS);
    const found = await this.prisma.analyticsEvent.findMany({
      where: {
        name: EVENT,
        userId: { not: null },
        createdAt: { gte: new Date(now - EVENT_RETENTION_DAYS * DAY_MS) },
      },
      select: { userId: true, meta: true, createdAt: true },
    });
    const rows = found.filter((r) => clientsEnded(r.meta) !== null);
    return {
      window: totals(rows),
      month: totals(rows.filter((r) => r.createdAt >= since30)),
    };
  }
}

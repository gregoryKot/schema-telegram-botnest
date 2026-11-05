import { Injectable } from '@nestjs/common';
import {
  THERAPY_INVITE_EVENT,
  THERAPY_INVITE_KINDS,
  THERAPY_INVITE_STEPS,
} from '../analytics/therapy-invite-events.constants';
import { PrismaService } from '../prisma/prisma.service';
import {
  formatTherapyInviteMetrics,
  TherapyInviteMetrics,
} from './therapy-invite-metrics.format';

const MONTH_MS = 30 * 86_400_000;

// Счётчики блока «Приглашения клиентов» для /stats. Prisma count с JSON-фильтром
// по meta, не сырой SQL (иначе запись в scripts/raw-sql-live-baseline.json,
// правило №18). step и kind — отдельные фильтры в AND; строка без kind из
// списка не попадает ни в одно ведро. Событие серверное, meta с клиента
// отбрасывается (ветки в sanitizeMeta нет).
@Injectable()
export class TherapyInviteMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  async render(): Promise<string> {
    return formatTherapyInviteMetrics(await this.getMetrics());
  }

  async getMetrics(now = new Date()): Promise<TherapyInviteMetrics> {
    const since = new Date(now.getTime() - MONTH_MS);
    const pairs = THERAPY_INVITE_STEPS.flatMap((step) =>
      THERAPY_INVITE_KINDS.map((kind) => ({ step, kind })),
    );
    const counts = await Promise.all(
      pairs.map(({ step, kind }) =>
        this.prisma.analyticsEvent.count({
          where: {
            name: THERAPY_INVITE_EVENT,
            createdAt: { gte: since },
            AND: [
              { meta: { path: ['step'], equals: step } },
              { meta: { path: ['kind'], equals: kind } },
            ],
          },
        }),
      ),
    );
    const out: TherapyInviteMetrics = {
      created: { new: 0, offline: 0 },
      joined: { new: 0, offline: 0 },
      revoked: { new: 0, offline: 0 },
    };
    pairs.forEach(({ step, kind }, i) => {
      out[step][kind] = counts[i];
    });
    return out;
  }
}

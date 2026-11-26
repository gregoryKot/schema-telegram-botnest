import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PUSH_EVENTS } from '../analytics/push-events.constants';
import { PushMetrics, formatPushMetrics } from './push-metrics.format';

const WEEK_MS = 7 * 86_400_000;

type Meta = Record<string, unknown> | null;
const metaOf = (v: unknown): Meta =>
  v && typeof v === 'object' ? (v as Record<string, unknown>) : null;

// Счётчики «Уведомления в приложении» для /stats: подписки сейчас (модель
// PushSubscription) и события недели (push-events.constants.ts). Серверные
// события считаются только со своей meta — строка, присланная клиентом через
// POST /api/event, приходит без неё (analytics-meta.sanitize.ts) и в отчёт не
// попадает. Событий за неделю единицы — агрегат в памяти, без сырого SQL.
@Injectable()
export class PushMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Готовый текстовый блок для /stats. */
  async render(): Promise<string> {
    return formatPushMetrics(await this.getMetrics());
  }

  async getMetrics(): Promise<PushMetrics> {
    const since = new Date(Date.now() - WEEK_MS);
    const [subs, events] = await Promise.all([
      this.prisma.pushSubscription.findMany({ select: { userId: true } }),
      this.prisma.analyticsEvent.findMany({
        where: { name: { in: [...PUSH_EVENTS] }, createdAt: { gte: since } },
        select: { name: true, meta: true, userId: true },
      }),
    ]);
    const enabled = new Set<string>();
    const denied = new Set<string>();
    const week = { ...EMPTY_WEEK };
    for (const e of events) {
      const meta = metaOf(e.meta);
      const who = String(e.userId);
      if (e.name === 'push_subscribed' && typeof meta?.service === 'string') {
        enabled.add(who);
        if (meta.delivered === false) week.firstMissed++;
      } else if (e.name === 'push_unsubscribed') {
        if (meta?.reason === 'user') week.disabled++;
        if (meta?.reason === 'logout') week.loggedOut++;
      } else if (e.name === 'push_gone' && meta && 'service' in meta) {
        week.gone++;
      } else if (e.name === 'push_denied' && e.userId !== null) {
        denied.add(who);
      }
    }
    return {
      people: new Set(subs.map((s) => String(s.userId))).size,
      devices: subs.length,
      week: { ...week, enabled: enabled.size, denied: denied.size },
    };
  }
}

const EMPTY_WEEK: PushMetrics['week'] = {
  enabled: 0,
  firstMissed: 0,
  disabled: 0,
  loggedOut: 0,
  denied: 0,
  gone: 0,
};

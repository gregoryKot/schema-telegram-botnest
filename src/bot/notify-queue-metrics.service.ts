import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  type NotifyQueueMetrics,
  type QueueTotals,
  type SnoozeTotals,
  formatNotifyQueueMetrics,
} from './notify-queue-metrics.format';

const DAY_MS = 86_400_000;
const FIELDS = ['sent', 'transient', 'waited', 'deferred'] as const;

const emptyTotals = (): QueueTotals => ({
  ticks: 0,
  sent: 0,
  transient: 0,
  waited: 0,
  deferred: 0,
});

/** Число из meta; всё прочее (нет поля, строка, минус) — ноль. */
function count(meta: unknown, key: string): number {
  if (!meta || typeof meta !== 'object') return 0;
  const v = (meta as Record<string, unknown>)[key];
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0;
}

function add(into: QueueTotals, meta: unknown): void {
  into.ticks++;
  for (const f of FIELDS) into[f] += count(meta, f);
}

// Счётчики очереди уведомлений для /stats: событие notify_queue_tick (итог
// прогона, пишет крон очереди — src/telegram/telegram.schedule-queue.tally.ts)
// и кнопка «Напомню через час» (reminder_snoozed, src/telegram/telegram.snooze.ts).
// Свой домен — свой файл (правило №10).
//
// Без сырого SQL: строк не больше одной на тик (288 в сутки, ~2000 в неделю),
// суммировать их в коде дешевле, чем заводить ещё один $queryRaw с живым
// спеком (правило №18).
@Injectable()
export class NotifyQueueMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Готовый текстовый блок для /stats. */
  async render(): Promise<string> {
    return formatNotifyQueueMetrics(await this.getMetrics());
  }

  async getMetrics(): Promise<NotifyQueueMetrics> {
    const now = Date.now();
    const since1 = new Date(now - DAY_MS);
    const since7 = new Date(now - 7 * DAY_MS);
    // userId: null — строки пишет только сервер, без userId. POST /api/event
    // открыт авторизованным клиентам и пишет с их userId (и без meta: у
    // события нет ветки в sanitizeMeta), так что накрутить отчёт нельзя.
    const [rows, snooze] = await Promise.all([
      this.prisma.analyticsEvent.findMany({
        where: {
          name: 'notify_queue_tick',
          userId: null,
          createdAt: { gte: since7 },
        },
        select: { meta: true, createdAt: true },
      }),
      this.snoozeTotals(since7),
    ]);
    const day = emptyTotals();
    const week = emptyTotals();
    for (const r of rows) {
      add(week, r.meta);
      if (r.createdAt >= since1) add(day, r.meta);
    }
    return { day, week, snooze };
  }

  /**
   * «Напомню через час»: нажатия — по событию (пишет только бот, с булевым
   * quietShift; строка с клиента приходит без meta и не считается), исход — по
   * самим отложенным напоминаниям (тип pre_reminder ставит только эта кнопка).
   * Окно напоминаний — по sendAt: так запрос идёт индексом очереди.
   */
  private async snoozeTotals(since: Date): Promise<SnoozeTotals> {
    const window = { type: 'pre_reminder', sendAt: { gte: since } };
    const [events, delivered, cancelled] = await Promise.all([
      this.prisma.analyticsEvent.findMany({
        where: { name: 'reminder_snoozed', createdAt: { gte: since } },
        select: { meta: true },
      }),
      this.prisma.scheduledNotification.count({
        where: { ...window, sentAt: { not: null } },
      }),
      this.prisma.scheduledNotification.count({
        where: { ...window, cancelledAt: { not: null } },
      }),
    ]);
    let snoozed = 0;
    let quietShift = 0;
    for (const { meta } of events) {
      const q = (meta as { quietShift?: unknown } | null)?.quietShift;
      if (typeof q !== 'boolean') continue;
      snoozed++;
      if (q) quietShift++;
    }
    return { snoozed, quietShift, delivered, cancelled };
  }
}

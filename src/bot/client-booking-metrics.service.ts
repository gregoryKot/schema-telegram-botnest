import { Injectable } from '@nestjs/common';
import {
  CLIENT_BOOKING_CREATED_EVENT,
  CLIENT_BOOKING_EVENTS,
  CLIENT_BOOKING_OPENED_EVENT,
  CLIENT_BOOKING_STATUSES,
} from '../analytics/client-booking-events.constants';
import { PrismaService } from '../prisma/prisma.service';
import {
  ClientBookingMetrics,
  formatClientBookingMetrics,
} from './client-booking-metrics.format';

const MONTH_MS = 30 * 86_400_000;
const STATUSES = new Set<string>(CLIENT_BOOKING_STATUSES);

/** Статус из meta; null — строка не от сервера (ветки в sanitizeMeta нет). */
function statusOf(meta: unknown): 'held' | 'confirmed' | null {
  const s = (meta as { status?: unknown } | null)?.status;
  return typeof s === 'string' && STATUSES.has(s)
    ? (s as 'held' | 'confirmed')
    : null;
}

// Счётчики блока «Запись из приложения» (/stats). Один findMany по индексу
// (name, createdAt) и раскладка в памяти — образец therapy-invite-metrics:
// записей — единицы в месяц, строки дешевле нескольких сканов с JSON-фильтром.
// Созданная бронь считается только со статусом в meta: его пишет сервер,
// с клиента meta отбрасывается — подделка через POST /api/event не считается.
@Injectable()
export class ClientBookingMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  async render(): Promise<string> {
    return formatClientBookingMetrics(await this.getMetrics());
  }

  async getMetrics(now = new Date()): Promise<ClientBookingMetrics> {
    const rows = await this.prisma.analyticsEvent.findMany({
      where: {
        name: { in: [...CLIENT_BOOKING_EVENTS] },
        createdAt: { gte: new Date(now.getTime() - MONTH_MS) },
      },
      select: { name: true, userId: true, meta: true },
    });
    const people = new Set<string>();
    const out: ClientBookingMetrics = {
      opened: 0,
      openedPeople: 0,
      held: 0,
      confirmed: 0,
    };
    for (const row of rows) {
      if (row.name === CLIENT_BOOKING_OPENED_EVENT) {
        out.opened += 1;
        if (row.userId !== null) people.add(String(row.userId));
      } else if (row.name === CLIENT_BOOKING_CREATED_EVENT) {
        const status = statusOf(row.meta);
        if (status) out[status] += 1;
      }
    }
    out.openedPeople = people.size;
    return out;
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  LoginTicketMetrics,
  formatLoginTicket,
} from './login-ticket-metrics.format';

// Счётчики пути входа по билету для /stats. Событие пишет только
// LoginTicketService (src/auth/login-ticket/login-ticket.report.ts), всегда
// с userId = null — фильтр ниже поэтому обязателен, а не декоративен:
// /api/event открыт авторизованным клиентам, и без него отчёт о здоровье
// входа мог бы накрутить любой из них.
//
// Свой домен — свой файл (правило №10), образец — auth-health-metrics.service.
@Injectable()
export class LoginTicketMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Готовый текстовый блок для /stats. */
  async render(): Promise<string> {
    return formatLoginTicket(await this.getMetrics());
  }

  async getMetrics(): Promise<LoginTicketMetrics> {
    const since7 = new Date(Date.now() - 7 * 86_400_000);
    const [row] = await this.prisma.$queryRaw<
      Array<{
        issued: bigint;
        bot_opened: bigint;
        confirmed: bigint;
        taken: bigint;
        too_late: bigint;
        denied: bigint;
      }>
    >`
      SELECT
        count(*) FILTER (WHERE "meta"->>'step' = 'issued')::bigint AS issued,
        count(*) FILTER (WHERE "meta"->>'step' = 'bot_opened')::bigint AS bot_opened,
        count(*) FILTER (WHERE "meta"->>'step' = 'confirmed')::bigint AS confirmed,
        count(*) FILTER (WHERE "meta"->>'step' = 'taken')::bigint AS taken,
        count(*) FILTER (WHERE "meta"->>'step' = 'too_late')::bigint AS too_late,
        count(*) FILTER (WHERE "meta"->>'step' = 'denied')::bigint AS denied
      FROM "AnalyticsEvent"
      WHERE "userId" IS NULL
        AND "name" = 'login_ticket_step'
        AND "createdAt" >= ${since7}`;
    return {
      issued: Number(row?.issued ?? 0n),
      botOpened: Number(row?.bot_opened ?? 0n),
      confirmed: Number(row?.confirmed ?? 0n),
      taken: Number(row?.taken ?? 0n),
      tooLate: Number(row?.too_late ?? 0n),
      denied: Number(row?.denied ?? 0n),
    };
  }
}

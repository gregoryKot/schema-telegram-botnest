import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  LoginTicketMetrics,
  formatLoginTicket,
} from './login-ticket-metrics.format';
import { OneTapMetrics, formatOneTap } from './one-tap-metrics.format';
import { formatLoginOffer, loadLoginOffer } from './login-offer-metrics';

// Счётчики пути входа по билету для /stats. Событие пишет только
// LoginTicketService (src/auth/login-ticket/login-ticket.report.ts), всегда
// с userId = null — фильтр ниже поэтому обязателен, а не декоративен:
// /api/event открыт авторизованным клиентам, и без него отчёт о здоровье
// входа мог бы накрутить любой из них. Образец — auth-health-metrics.service.
@Injectable()
export class LoginTicketMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Блок /stats: вход по коду, окно Google (история), приглашение добавить почту. */
  async render(): Promise<string> {
    const [ticket, oneTap, offer] = await Promise.all([
      this.getMetrics(),
      this.getOneTap(),
      loadLoginOffer(this.prisma),
    ]);
    return `${formatLoginTicket(ticket)}\n\n${formatOneTap(oneTap)}\n\n${formatLoginOffer(offer)}`;
  }

  /** Входы через окно Google за неделю — те же правила: только userId IS NULL. */
  async getOneTap(): Promise<OneTapMetrics> {
    const since7 = new Date(Date.now() - 7 * 86_400_000);
    const [row] = await this.prisma.$queryRaw<
      Array<{ signed_in: bigint; twofa: bigint; rejected: bigint }>
    >`
      SELECT
        count(*) FILTER (WHERE "meta"->>'outcome' = 'signed_in')::bigint AS signed_in,
        count(*) FILTER (WHERE "meta"->>'outcome' = 'twofa')::bigint AS twofa,
        count(*) FILTER (WHERE "meta"->>'outcome' = 'rejected')::bigint AS rejected
      FROM "AnalyticsEvent"
      WHERE "userId" IS NULL
        AND "name" = 'login_one_tap'
        AND "createdAt" >= ${since7}`;
    return {
      signedIn: Number(row?.signed_in ?? 0n),
      twofa: Number(row?.twofa ?? 0n),
      rejected: Number(row?.rejected ?? 0n),
    };
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

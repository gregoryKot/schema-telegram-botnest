import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BookingStatus, SessionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { CLIENT_BOOKING_CREATED_EVENT } from '../analytics/client-booking-events.constants';
import { practiceOwnerUserId } from '../utils/practice-owner';
import { BookingService } from './booking.service';
import { clientIdentity } from './client-booking.identity';

// Запись клиента на сессию из приложения (issue #546). Тонкий слой над той же
// цепочкой BookingService.book, что у публичной /book: оферта, TOO_SOON,
// окно расписания, цена по поясу, advisory-lock, HELD + оплата для рублей.
// Своё здесь только три вещи: кто имеет право (активная связь с владельцем
// практики — календарь в системе один, его), имя и контакт из аккаунта вместо
// формы и привязка брони к аккаунту (Booking.userId, clientTelegramId из
// проверенной подписи, не из тела — C-9). Оферта принимается действием:
// строка у кнопки на экране (ClientBookingSheet), отсюда acceptedOffer: true.
// nextSession связи запись НЕ пишет (два источника правды, docs/open/therapy.md).

export const CLIENT_BOOKING_NOT_ALLOWED = 'CLIENT_BOOKING_NOT_ALLOWED';
/** Атрибуция в уведомлении владельцу: бронь пришла из «Мой терапевт». */
export const CLIENT_BOOKING_SOURCE = 'приложение: «Мой терапевт»';
const UPCOMING_LIMIT = 5;

export interface ClientBookingView {
  startsAt: string;
  durationMin: number;
  status: 'HELD' | 'CONFIRMED';
  heldUntil: string | null;
  manageUrl: string;
}

export interface ClientBookingOverview {
  eligible: boolean;
  upcoming: ClientBookingView[];
}

/** Ответ BookingService.book (тот же, что у публичной /book) + ссылка управления. */
type BookingResult = Awaited<ReturnType<BookingService['book']>>;

export interface ClientBookInput {
  startsAt: Date;
  durationMin: number;
  clientTimeZone?: string;
}

@Injectable()
export class ClientBookingService {
  private readonly siteUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly booking: BookingService,
    private readonly analytics: AnalyticsService,
    config: ConfigService,
  ) {
    // Страница управления записью живёт на визитке (PRACTICE_PAGES) — тот же
    // env и дефолт, что у ссылки в .ics и письмах (booking.controller.ts).
    this.siteUrl = (
      config.get<string>('SITE_URL') ?? 'https://kotlarewski.gr'
    ).replace(/\/$/, '');
  }

  /** Активная связь клиента с владельцем практики; null — записи из приложения нет. */
  async ownerRelation(
    userId: bigint,
  ): Promise<{ clientAlias: string | null } | null> {
    const ownerId = await practiceOwnerUserId(this.prisma);
    if (ownerId === null || ownerId === userId) return null;
    return this.prisma.therapyRelation.findFirst({
      where: { clientId: userId, therapistId: ownerId, status: 'active' },
      select: { clientAlias: true },
    });
  }

  /** Можно ли записаться и свои ближайшие брони (только по userId из гарда). */
  async overview(
    userId: bigint,
    now = new Date(),
  ): Promise<ClientBookingOverview> {
    const [relation, rows] = await Promise.all([
      this.ownerRelation(userId),
      this.prisma.booking.findMany({
        where: {
          userId,
          startsAt: { gt: now },
          OR: [
            { status: BookingStatus.CONFIRMED },
            { status: BookingStatus.HELD, heldUntil: { gt: now } },
          ],
        },
        orderBy: { startsAt: 'asc' },
        take: UPCOMING_LIMIT,
        select: {
          startsAt: true,
          durationMin: true,
          status: true,
          heldUntil: true,
          cancelToken: true,
        },
      }),
    ]);
    return {
      eligible: relation !== null,
      upcoming: rows.map((r) => ({
        startsAt: r.startsAt.toISOString(),
        durationMin: r.durationMin,
        status: r.status === BookingStatus.HELD ? 'HELD' : 'CONFIRMED',
        heldUntil: r.heldUntil?.toISOString() ?? null,
        manageUrl: this.manageUrl(r.cancelToken),
      })),
    };
  }

  async book(
    userId: bigint,
    input: ClientBookInput,
  ): Promise<BookingResult & { manageUrl: string }> {
    const relation = await this.ownerRelation(userId);
    if (!relation) throw new ForbiddenException(CLIENT_BOOKING_NOT_ALLOWED);
    const who = await clientIdentity(this.prisma, userId, relation.clientAlias);
    const res = await this.booking.book(
      {
        startsAt: input.startsAt,
        durationMin: input.durationMin,
        type: SessionType.SESSION_50,
        clientName: who.name,
        clientContact: who.contact,
        clientChannel: who.channel,
        returning: false,
        acceptedOffer: true,
        source: CLIENT_BOOKING_SOURCE,
        clientTimeZone: input.clientTimeZone,
      },
      { userId, telegramId: who.telegramId },
    );
    await this.analytics.track(userId, CLIENT_BOOKING_CREATED_EVENT, {
      status: res.status === BookingStatus.HELD ? 'held' : 'confirmed',
    });
    return { ...res, manageUrl: this.manageUrl(res.cancelToken) };
  }

  private manageUrl(cancelToken: string): string {
    return `${this.siteUrl}/booking/manage?token=${cancelToken}`;
  }
}

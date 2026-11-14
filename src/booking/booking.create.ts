import { ConflictException, HttpException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BookingNotifyService } from './booking-notify.service';
import { lockBookingSlots } from './booking-slot-lock';
import { assertSlotFree } from './booking.availability';
import {
  assertCalendarFree,
  CalendarBusySource,
} from './booking-calendar-guard';
import type { LostLead } from './booking-notify.format';
import { lostLeadNotice } from './booking-owner-card';
import { errorKind } from '../utils/owner-card';
import type { AnalyticsService } from '../analytics/analytics.service';
import { BOOKING_SLOT_TAKEN_EVENT } from '../analytics/booking-events.constants';

export interface CreateDeps {
  prisma: PrismaService;
  notify: Pick<BookingNotifyService, 'notifyAdminBoth'>;
  logger: Logger;
  /** Счётчик «время уже заняли» для /stats (booking-events.constants.ts). */
  analytics?: Pick<AnalyticsService, 'track'>;
  /** Занятость календаря — только при CALENDAR_BLOCK_SLOTS=true (booking-calendar-guard.ts). */
  calendar?: CalendarBusySource;
}

type BookingCreateData = Prisma.BookingCreateArgs['data'];

/**
 * Создание брони под advisory-lock: проверка занятости и INSERT — в одной
 * транзакции, иначе два клиента бронировали один слот. НЕОЖИДАННОЕ падение
 * (драйвер, БД, сеть) — заявка уходит владельцу лидом (письмо с именем и
 * контактом, Telegram — слот и тип ошибки), затем исключение летит дальше:
 * клиент не должен увидеть ложный успех. HttpException идут как шли.
 */
export async function createBookingGuarded(
  deps: CreateDeps,
  data: BookingCreateData,
  lead: LostLead,
) {
  try {
    // До лока, с таймаутом: событие в iCloud ставит не наш код, лок от него не защищает.
    await assertCalendarFree(deps.calendar, lead, deps.logger);
    return await deps.prisma.$transaction(async (tx) => {
      await lockBookingSlots(tx);
      await assertSlotFree(tx, lead.startsAt, lead.durationMin);
      return tx.booking.create({ data });
    });
  } catch (e) {
    // 409 законен при гонке двух клиентов, но его доля в /stats показывает,
    // не предлагает ли сайт занятое время (аудит 2026-10, r2-1#2). track не бросает.
    if (e instanceof ConflictException)
      await deps.analytics?.track(null, BOOKING_SLOT_TAKEN_EVENT);
    if (e instanceof HttpException) throw e;
    const reason = e instanceof Error ? e.message : String(e);
    // error уходит владельцу в Telegram: стабильный тип ошибки; текст — в warn.
    deps.logger.error(`Booking create failed, lead alerted: ${errorKind(e)}`);
    deps.logger.warn(`Booking create failure: ${reason}`);
    await deps.notify.notifyAdminBoth(
      lostLeadNotice(lead, errorKind(e), reason),
      '🚨 Заявка на запись не сохранилась',
    );
    throw e;
  }
}

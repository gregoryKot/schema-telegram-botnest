import { HttpException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BookingNotifyService } from './booking-notify.service';
import { lockBookingSlots } from './booking-slot-lock';
import { assertSlotFree } from './booking.availability';
import { LostLead, lostLeadAlertText } from './booking-notify.format';

export interface CreateDeps {
  prisma: PrismaService;
  notify: Pick<BookingNotifyService, 'notifyAdminBoth'>;
  logger: Logger;
}

type BookingCreateData = Prisma.BookingCreateArgs['data'];

/**
 * Создание брони под advisory-lock (P-1, аудит 2026-07: проверка занятости и
 * INSERT — в одной транзакции, иначе два клиента бронировали один слот).
 *
 * Резерв (инцидент 2026-09-13): любое НЕОЖИДАННОЕ падение здесь — ошибка
 * драйвера, БД, сети — раньше уходило клиенту 500-кой, а имя и контакт
 * человека терялись безвозвратно. Теперь заявка уходит админу как «лид» в
 * оба канала сразу (Telegram + почта), и только потом исключение
 * пробрасывается дальше: клиент не должен увидеть ложный успех. Ожидаемые
 * исходы (слот занят, невалидные данные) — HttpException — идут как шли.
 */
export async function createBookingGuarded(
  deps: CreateDeps,
  data: BookingCreateData,
  lead: LostLead,
) {
  try {
    return await deps.prisma.$transaction(async (tx) => {
      await lockBookingSlots(tx);
      await assertSlotFree(tx, lead.startsAt, lead.durationMin);
      return tx.booking.create({ data });
    });
  } catch (e) {
    if (e instanceof HttpException) throw e;
    const reason = e instanceof Error ? e.message : String(e);
    // Стабильный текст без цифр в начале — троттлинг AlertLogger по ключу.
    deps.logger.error(`Booking create failed, lead alerted: ${reason}`);
    await deps.notify.notifyAdminBoth(
      lostLeadAlertText(lead, reason),
      '🚨 Заявка на запись не сохранилась',
    );
    throw e;
  }
}

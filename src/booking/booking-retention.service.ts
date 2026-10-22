import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

// Обезличивание броней по сроку (находка L3 аудита 2026-07-20, решение
// владельца 2026-10-08). У брони нет связи с аккаунтом (`clientTelegramId` не
// записывается: форма записи публичная, контекста входа у POST
// /api/booking/book нет), поэтому удаление аккаунта её не достаёт. Имя,
// контакт и текст запроса лежали бы в БД вечно. Через 12 месяцев после даты
// сессии крон их затирает; сама запись остаётся.
//
// Затираются РОВНО три поля: clientName, clientContact, message. Остальное —
// дата, тип, статус, согласие с офертой (acceptedOfferAt), cancelToken,
// calDavUid, source, clientChannel, clientTimeZone, meetingUrl — остаётся:
// это факт записи, а не данные человека. Список не расширять без решения
// владельца: каждое новое поле — потеря учётной информации, которую не вернуть.
//
// Пустая строка вместо шифртекста: decrypt('') отдаёт '' сразу, без попытки
// расшифровки и без алерта (src/utils/crypto.ts), так что plaintext '' в
// шифрованной колонке безопасен. Доказано на живой базе:
// test/booking-pii-retention.e2e-spec.ts.
//
// Без leader-election (scripts/cron-leader-baseline.json — `exempt`):
// updateMany идемпотентен, второй инстанс на том же тике обновит 0 строк
// (первый уже проставил anonymizedAt), наружу ничего не уходит.
export const BOOKING_PII_RETENTION_MONTHS = 12;

function shiftMonthsUtc(date: Date, months: number): Date {
  const shifted = new Date(date.getTime());
  shifted.setUTCMonth(shifted.getUTCMonth() + months);
  return shifted;
}

/**
 * Граница срока: «сейчас минус 12 календарных месяцев» в UTC. Месяцы — честные,
 * не «365 дней»: через високосный год разница в сутки. Побочный эффект
 * `setUTCMonth`: если в целевом месяце нет такого числа (29 февраля минус год),
 * дата переливается вперёд — на 1 марта (см. спек).
 */
export function anonymizeCutoff(now: Date): Date {
  return shiftMonthsUtc(now, -BOOKING_PII_RETENTION_MONTHS);
}

/** Когда у брони выйдет срок: дата сессии плюс 12 месяцев (для отчёта /stats). */
export function anonymizeDueAt(startsAt: Date): Date {
  return shiftMonthsUtc(startsAt, BOOKING_PII_RETENTION_MONTHS);
}

@Injectable()
export class BookingRetentionService {
  private readonly logger = new Logger(BookingRetentionService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('41 4 * * *', { name: 'bookingPiiRetention' })
  async anonymizeOld(now = new Date()): Promise<{ anonymized: number }> {
    try {
      const { count } = await this.prisma.booking.updateMany({
        where: { startsAt: { lt: anonymizeCutoff(now) }, anonymizedAt: null },
        data: {
          clientName: '',
          clientContact: '',
          message: null,
          anonymizedAt: now,
        },
      });
      if (count > 0) this.logger.log(`ретеншен броней: обезличено ${count}`);
      return { anonymized: count };
    } catch (err) {
      // Ошибка в stdout вторым аргументом: первый уходит админу в DM.
      this.logger.error('booking retention failed', err as Error);
      return { anonymized: 0 };
    }
  }
}

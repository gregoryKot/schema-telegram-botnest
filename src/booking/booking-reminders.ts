import { Logger } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { decryptRecord } from '../utils/crypto';
import { BOOKING_SCHEMA } from './booking.schema';
import type { PlainBooking } from './booking-notify.service';

// Напоминания админу о сессии за сутки и за 2 часа (крон sendReminders в
// booking-notify.service.ts). Вынесено оттуда (правило №10).

export interface RemindDeps {
  prisma: PrismaService;
  logger: Logger;
  sendAdmin: (title: string, b: PlainBooking) => Promise<void>;
}

/**
 * Не больше одного напоминания на окно (аудит 2026-10, r2-3#3 (а)). Метка
 * ставится условным UPDATE `WHERE <поле> IS NULL` ДО отправки, по образцу
 * очереди уведомлений бота: из двух наложившихся прогонов (аренда истекла
 * посреди медленного тика, второй инстанс) строку берёт один, второй видит
 * 0 строк и молчит. Раньше метка писалась ПОСЛЕ отправки: падение записи или
 * второй прогон давали админу дубль.
 *
 * Захват на сбое отправки не снимается. notifyAdminBoth не бросает: Telegram
 * отвечает false, почта ловит ошибку в лог `error`. А «Telegram не ответил»
 * не значит «не доставил» (таймаут после приёма), и снятый захват вернул бы
 * тот самый дубль. Цена — при падении обоих каналов это напоминание пропадёт;
 * сбой обоих уже виден в логе уровнем `error`.
 */
export async function remindWindow(
  d: RemindDeps,
  beforeMs: number,
  field: 'reminder24SentAt' | 'reminder2SentAt',
  when: string,
): Promise<number> {
  const due = await d.prisma.booking.findMany({
    where: {
      status: BookingStatus.CONFIRMED,
      startsAt: { gt: new Date(), lte: new Date(beforeMs) },
      [field]: null,
    },
  });
  let claimedCount = 0;
  for (const row of due) {
    const b = decryptRecord(row, BOOKING_SCHEMA) as unknown as PlainBooking;
    // CONFIRMED в WHERE: бронь, отменённую после выборки, не напоминаем.
    const claimed = await d.prisma.booking.updateMany({
      where: { id: b.id, status: BookingStatus.CONFIRMED, [field]: null },
      data: { [field]: new Date() },
    });
    if (claimed.count === 0) continue;
    claimedCount++;
    // Захват уже стоит: исключение здесь (сборка текста, не только сеть)
    // теряет это напоминание — пусть потеря будет видна с id брони, а
    // остальные строки тика отработают.
    try {
      await d.sendAdmin(`⏰ <b>Напоминание: сессия ${when}</b>`, b);
    } catch (e) {
      d.logger.error(
        `${field} reminder lost for booking ${b.id}: ${String(e)}`,
      );
    }
  }
  // «Захвачено», а не «отправлено»: доставку каналы пишут в лог сами.
  if (claimedCount)
    d.logger.log(`Claimed ${claimedCount} ${field} reminder(s)`);
  return claimedCount;
}

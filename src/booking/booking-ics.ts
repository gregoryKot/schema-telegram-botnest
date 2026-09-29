import { GoneException, NotFoundException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { buildVcalendar } from './caldav-event.util';

// .ics для клиента (PR B) — отдельная сборка от CalDAV-события владельца
// (booking-notify.service.ts::onConfirmed), потому что владельческое событие
// несёт PII (имя/контакт клиента в SUMMARY/DESCRIPTION), а клиентский файл
// уходит в личный календарь клиента и должен быть анонимным. Механика та же
// (buildVcalendar/CalEvent, правило «одна механика — один компонент»),
// содержимое — разное по назначению, не по случайности.

const ALARM_MINUTES_BEFORE = 60;

/**
 * Собирает .ics для клиента по self-cancel токену (та же capability, что у
 * ссылки управления записью — просмотр + отмена).
 *   404 — токен неизвестен.
 *   410 — бронь отменена: календарного события для отменённой встречи нет.
 */
export async function buildBookingIcsText(
  prisma: PrismaService,
  token: string,
  siteUrl: string,
): Promise<string> {
  const b = await prisma.booking.findUnique({ where: { cancelToken: token } });
  if (!b) throw new NotFoundException('Booking not found');
  if (b.status === BookingStatus.CANCELLED) {
    throw new GoneException('Booking cancelled');
  }

  const manageUrl = `${siteUrl}/booking/manage?token=${token}`;
  const summary =
    b.type === 'INTRO_15'
      ? 'Знакомство с Григорием Котляревским'
      : 'Встреча с Григорием Котляревским';
  const description = [
    b.meetingUrl ? `Ссылка на встречу: ${b.meetingUrl}` : null,
    `Посмотреть или отменить запись: ${manageUrl}`,
  ]
    .filter(Boolean)
    .join('\n');

  return buildVcalendar([
    {
      uid: `booking-${b.id}-client@schemehappens.ru`,
      startsAt: b.startsAt,
      durationMin: b.durationMin,
      summary,
      description,
      location: b.meetingUrl ?? undefined,
      url: manageUrl,
      alarmMinutesBefore: ALARM_MINUTES_BEFORE,
    },
  ]);
}

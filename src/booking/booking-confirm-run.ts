import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CalDavService } from './caldav.service';
import { MeetingService } from './meeting.service';
import { encrypt } from '../utils/crypto';
import { sessionLabel } from './caldav-event.util';
import { formatTime, subjectFromTitle } from './booking-notify.format';
import type { PlainBooking } from './booking-notify.service';

// Тело onConfirmed: ссылка на встречу, событие календаря, флаг, DM админу.
// Вынесено из booking-notify.service.ts (правило №10: файл под храповиком не
// растёт). Глобальный аудит 2026-10-11, security#21.

export interface ConfirmRunDeps {
  prisma: PrismaService;
  meeting: MeetingService;
  calDav: CalDavService;
  sendAdmin: (title: string, b: PlainBooking) => Promise<void>;
  notifyAdminBoth: (html: string, subject: string) => Promise<void>;
}

/**
 * Идемпотентен по состоянию строки: повтор после падения (ретрай вебхука,
 * ручное подтверждение, крон-добор) пропускает сделанное — есть `meetingUrl`
 * (встречу заново не создаём), есть `calDavUid` (событие не пушим), стоит
 * `confirmEffectsDoneAt` (не делаем ничего). Флаг ставится CAS-ом после
 * рискованных шагов (БД, Zoom, CalDAV) и ДО DM/писем: два прохода, дошедшие до
 * конца одновременно, уведомят один раз. Цена — смерть пода в миллисекундах
 * между флагом и DM теряет «Запись подтверждена»; сама бронь при этом
 * полностью доделана и видна в админке. Мутирует b.meetingUrl.
 */
export async function runConfirmEffects(
  d: ConfirmRunDeps,
  b: PlainBooking,
): Promise<void> {
  if (b.confirmEffectsDoneAt) return;
  if (!b.meetingUrl) {
    b.meetingUrl = await d.meeting.createMeeting(b);
    await d.prisma.booking.update({
      where: { id: b.id },
      // В БД ссылка лежит зашифрованной (`?pwd=` пускает в комнату клиента).
      data: { meetingUrl: encrypt(b.meetingUrl) },
    });
  }
  // Отмена могла прийти, пока шла ссылка: событие в календаре и «Запись
  // подтверждена» для отменённой брони — ложь владельцу (ревью security#21).
  const fresh = await d.prisma.booking.findUnique({
    where: { id: b.id },
    select: { status: true },
  });
  if (fresh?.status !== BookingStatus.CONFIRMED) return;
  let uid = b.calDavUid ?? null;
  if (!uid) {
    uid = await d.calDav.pushEvent({
      uid: `booking-${b.id}@schemehappens.ru`,
      startsAt: b.startsAt,
      durationMin: b.durationMin,
      summary: `${sessionLabel(b.type)} — ${b.clientName}`,
      description: [b.clientContact, b.message, b.meetingUrl]
        .filter(Boolean)
        .join('\n'),
      location: b.meetingUrl ?? undefined,
    });
    if (uid) {
      await d.prisma.booking.update({
        where: { id: b.id },
        data: { calDavUid: uid },
      });
    }
  }
  const claimed = await d.prisma.booking.updateMany({
    where: {
      id: b.id,
      status: BookingStatus.CONFIRMED,
      confirmEffectsDoneAt: null,
    },
    data: { confirmEffectsDoneAt: new Date() },
  });
  // 0 строк: параллельный проход уже довёл и уведомил, либо бронь отменена.
  if (claimed.count === 0) return;
  await d.sendAdmin('✅ <b>Запись подтверждена</b>', b);
  // CalDAV настроен, но запись не удалась — тоже событие брони: оба канала.
  if (d.calDav.enabled && !uid) {
    const title = '⚠ <b>Подтверждена, но НЕ попала в Apple Calendar</b>';
    await d.notifyAdminBoth(
      `${title}\n${formatTime(b.startsAt)} · ${b.clientName}\nДобавьте в календарь вручную.`,
      subjectFromTitle(title),
    );
  }
}

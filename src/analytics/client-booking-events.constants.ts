// Запись клиента на сессию из приложения (#546, правило №8). Отдельный файл —
// analytics.constants.ts заморожен в храповике размера (правило №10).
//
//   client_booking_opened  — клиент открыл лист «Записаться на сессию» из
//                            «Мой терапевт». Шлёт сайт, без meta.
//   client_booking_created — бронь создана. СЕРВЕРНОЕ событие: пишет
//                            ClientBookingService после BookingService.book,
//                            meta { status: CLIENT_BOOKING_STATUSES } — ждёт
//                            оплаты (held) или подтверждена сразу (confirmed).
//                            Ветки в sanitizeMeta нет: meta с клиента
//                            отбрасывается, /stats считает только строки со
//                            статусом из списка (тот же приём, что у therapy_invite).
// Блок в /stats — «Запись из приложения» (src/bot/client-booking-metrics.*).
export const CLIENT_BOOKING_OPENED_EVENT = 'client_booking_opened';
export const CLIENT_BOOKING_CREATED_EVENT = 'client_booking_created';

export const CLIENT_BOOKING_EVENTS = [
  CLIENT_BOOKING_OPENED_EVENT,
  CLIENT_BOOKING_CREATED_EVENT,
] as const;

export const CLIENT_BOOKING_STATUSES = ['held', 'confirmed'] as const;
export type ClientBookingStatus = (typeof CLIENT_BOOKING_STATUSES)[number];

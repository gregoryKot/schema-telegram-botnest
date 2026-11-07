// События записи на сессию (правило №8). Отдельный файл — analytics.constants.ts
// заморожен в храповике размера (правило №10); запись из приложения — свой
// реестр рядом (client-booking-events.constants.ts), он входит сюда целиком.
//
//   booking_slot_taken — запись не создана: выбранное время уже заняли (409
//                        «Slot already taken» из assertSlotFree). СЕРВЕРНОЕ
//                        событие: пишет createBookingGuarded
//                        (src/booking/booking.create.ts), userId = null, без
//                        meta — общее для POST /api/booking/book и записи из
//                        приложения. /stats верит только строкам с userId = null
//                        (с клиента через POST /api/event событие приходит со
//                        своим userId) и считает долю таких отказов среди попыток
//                        (src/bot/booking-slot-taken-metrics.ts).
import { CLIENT_BOOKING_EVENTS } from './client-booking-events.constants';

export const BOOKING_SLOT_TAKEN_EVENT = 'booking_slot_taken';

export const BOOKING_EVENTS = [
  ...CLIENT_BOOKING_EVENTS,
  BOOKING_SLOT_TAKEN_EVENT,
] as const;

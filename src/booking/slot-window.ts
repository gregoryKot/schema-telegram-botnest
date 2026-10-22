// Окно, в котором SlotService раздаёт слоты, и окно, в котором он ищет
// занятость, — одно и то же. Раньше слоты считались по целым UTC-суткам
// fromDate..toDate, а брони и события календаря читались по сырому
// fromDate..toDate: GET /slots без параметров ставит toDate = now+14д (момент
// посреди суток), и всё, что начиналось на 14-й день позже этого времени
// суток, раздавалось свободным (аудит 2026-10-11, r2-1#2). Клиент заполнял
// форму и получал 409. Один источник окна на все три выборки (слоты, брони,
// календарь) закрывает класс: расхождение границ невозможно по построению.

// D1 (аудит 2026-08): жёсткий потолок перебора по суткам в getSlots — год с
// запасом. Контроллер режет пользовательский запрос строже (92 дня); это —
// абсолютный предохранитель от зависания event-loop при вызове в обход него.
export const MAX_SLOT_SCAN_DAYS = 366;

// Верхняя оценка длительности ЛЮБОЙ брони, а не длительности по правилу:
// sessionDuration правила ≤ 480 (booking-admin.dto.ts), Booking.durationMin при
// создании ≤ 180 (book.dto.ts, booking.availability.ts). Берём большее из двух:
// не снижай до 180, не проверив все пути создания брони. Бронь, начавшаяся
// раньше окна, но заходящая в него, занимает его начало — смотрим назад на эту
// длительность.
export const MAX_BOOKING_MIN = 480;

export interface SlotWindow {
  /** 00:00:00.000Z дня fromDate. */
  rangeStart: Date;
  /** 23:59:59.999Z дня toDate, но не дальше MAX_SLOT_SCAN_DAYS от rangeStart. */
  rangeEnd: Date;
  /** Нижняя граница выборки броней: rangeStart минус самая долгая сессия. */
  bookingScanFrom: Date;
}

/**
 * Окно слотов — целые UTC-сутки fromDate..toDate (так исторически трактует
 * диапазон вызывающий код: /api/booking/slots?from=YYYY-MM-DD&to=YYYY-MM-DD
 * без времени).
 */
export function computeSlotWindow(fromDate: Date, toDate: Date): SlotWindow {
  const rangeStart = new Date(fromDate);
  rangeStart.setUTCHours(0, 0, 0, 0);
  const rawRangeEnd = new Date(toDate);
  rawRangeEnd.setUTCHours(23, 59, 59, 999);
  const maxEndMs = rangeStart.getTime() + MAX_SLOT_SCAN_DAYS * 86_400_000;
  const rangeEnd =
    rawRangeEnd.getTime() > maxEndMs ? new Date(maxEndMs) : rawRangeEnd;
  return {
    rangeStart,
    rangeEnd,
    bookingScanFrom: new Date(rangeStart.getTime() - MAX_BOOKING_MIN * 60_000),
  };
}

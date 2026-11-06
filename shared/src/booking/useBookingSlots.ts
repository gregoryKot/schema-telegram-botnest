// Свободные слоты записи — одна механика на оба входа (правило №3): публичная
// запись визитки (BookingPicker, страницы / и /book) и запись клиента из
// приложения («Мой терапевт» → ClientBookingSheet, #546). Источник один —
// GET /api/booking/slots, его передаёт вызывающий (`load`), а день и время в
// зоне посетителя раскладывает groupByLocalDay (clientTimeZone.ts).
import { useEffect, useState } from 'react';
import { localDayKey } from './clientTimeZone';

export interface SlotLike {
  startsAt: string;
}

/** Дубли startsAt — вон: два правила расписания давали один слот дважды (инцидент 2026-09-29). */
export function uniqueSlots<T extends SlotLike>(raw: readonly T[]): T[] {
  const seen = new Set<string>();
  return raw.filter((s) => {
    if (seen.has(s.startsAt)) return false;
    seen.add(s.startsAt);
    return true;
  });
}

/** День, открытый по умолчанию: день первого слота в зоне посетителя; слотов нет — ''. */
export function firstSlotDay(
  slots: readonly SlotLike[] | null,
  tz: string,
): string {
  return slots && slots.length > 0 ? localDayKey(slots[0].startsAt, tz) : '';
}

export interface BookingSlotsState<T> {
  /** null — ещё грузится или загрузка не удалась (см. `failed`). */
  slots: T[] | null;
  failed: boolean;
}

/**
 * Загрузка слотов на маунт. `load` — стабильная функция модуля api
 * (`api.getSlots`): новая ссылка на каждый рендер перезапускала бы запрос.
 */
export function useBookingSlots<T extends SlotLike>(
  load: () => Promise<T[]>,
): BookingSlotsState<T> {
  const [state, setState] = useState<BookingSlotsState<T>>({
    slots: null,
    failed: false,
  });
  useEffect(() => {
    let alive = true;
    load()
      .then((raw) => {
        if (alive) setState({ slots: uniqueSlots(raw), failed: false });
      })
      .catch(() => {
        if (alive) setState({ slots: null, failed: true });
      });
    return () => {
      alive = false;
    };
  }, [load]);
  return state;
}

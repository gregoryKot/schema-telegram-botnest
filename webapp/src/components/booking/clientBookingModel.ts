// Логика записи клиента из приложения (#546) без разметки: какую бронь
// показать в «Мой терапевт», как подписать её статус и чем закончилось
// «Записаться». Время — момент (ISO с зоной), показывается в зоне смотрящего
// (правило №25); подписи дня и времени — те же, что у слотов (clientTimeZone).
import type { ClientBookingView } from '../../api';
import { localDayLabel, localTimeLabel } from '../../../../shared/src/booking/clientTimeZone';

/** Ближайшая своя бронь: сервер отдаёт будущие по возрастанию; нет — null. */
export function nextBooking(upcoming: readonly ClientBookingView[] | null | undefined): ClientBookingView | null {
  return upcoming && upcoming.length > 0 ? upcoming[0] : null;
}

/** «Завтра, 16:00» — когда сессия, в зоне смотрящего. */
export function sessionWhen(iso: string, tz: string, now: Date = new Date()): string {
  return `${localDayLabel(iso, tz, now)}, ${localTimeLabel(iso, tz)}`;
}

/** Статус брони одной безличной строкой: подтверждена или ждёт оплаты (и до какого времени). */
export function bookingStatusNote(v: ClientBookingView, tz: string): string {
  if (v.status === 'CONFIRMED') return 'Запись подтверждена';
  if (!v.heldUntil) return 'Ждёт оплаты';
  return `Ждёт оплаты до ${localTimeLabel(v.heldUntil, tz)}, потом время освободится`;
}

/** Чем кончилось «Записаться»: ссылка на оплату — к оплате, без неё — запись уже подтверждена. */
export function bookOutcome(res: { paymentUrl: string | null }): 'pay' | 'done' {
  return res.paymentUrl ? 'pay' : 'done';
}

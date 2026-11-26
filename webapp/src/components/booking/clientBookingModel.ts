// Логика записи клиента из приложения (#546) без разметки: какую бронь
// показать в «Мой терапевт», как подписать её статус и чем закончилось
// «Записаться». Время — момент (ISO с зоной), показывается в зоне смотрящего
// (правило №25); подписи дня и времени — те же, что у слотов (clientTimeZone).
import type { ClientBookingView } from '../../api';
import { fmtDate } from '../../../../shared/src/utils/format';
import { localDayKey, localDayLabel, localTimeLabel } from '../../../../shared/src/booking/clientTimeZone';

/** Ближайшая своя бронь: сервер отдаёт будущие по возрастанию; нет — null. */
export function nextBooking(upcoming: readonly ClientBookingView[] | null | undefined): ClientBookingView | null {
  return upcoming && upcoming.length > 0 ? upcoming[0] : null;
}

/** «Завтра · 16:00», дальше «Вс, 15 ноя · 18:00» — тот же вид, что у `nextSessionLabel` терапевта. */
export function sessionWhen(iso: string, tz: string, now: Date = new Date()): string {
  const rel = localDayLabel(iso, tz, now);
  let day = rel;
  if (rel !== 'Сегодня' && rel !== 'Завтра') {
    const wd = new Intl.DateTimeFormat('ru-RU', { timeZone: tz, weekday: 'short' }).format(new Date(iso));
    day = `${wd.charAt(0).toUpperCase()}${wd.slice(1)}, ${fmtDate(localDayKey(iso, tz))}`;
  }
  return `${day} · ${localTimeLabel(iso, tz)}`;
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

/** Фраза сбоя → заголовок и продолжение (PaperAlert): делится по первой точке или двоеточию с пробелом;
 *  слова и порядок те же, одна фраза — целиком в заголовке. */
export function leadAndRest(text: string): [string, string] {
  const m = /^(.*?[.:])\s+(.+)$/s.exec(text);
  return m ? [m[1], m[2]] : [text, ''];
}

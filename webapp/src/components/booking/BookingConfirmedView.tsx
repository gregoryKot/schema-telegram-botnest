import { BookingSaveBlock } from './BookingSaveBlock';
import { BookingCancelControl } from './BookingCancelControl';
import { BookingSessionCard } from './BookingSessionCard';
import type { PublicBooking } from './useBookingByToken';
import { h1, sub } from './bookingPageStyles';
import { icon, primaryBtn, ghostBtn, hint } from './bookingPaidStyles';

/** Бронь CONFIRMED: единственное место, где говорим «Встреча подтверждена». */
export function BookingConfirmedView({ booking, token, onReload, onCancelled }: {
  booking: PublicBooking;
  token: string | null;
  onReload: () => void;
  onCancelled: () => void;
}) {
  // ym-hide-content на собственном корне: ссылка встречи (Zoom с ?pwd=) и
  // cancelToken в BookingSaveBlock — секреты, которые Вебвизор визитки писать
  // не должен; защита едет с компонентом, а не с родителем (security#26).
  return (
    <div className="ym-hide-content">
      <div style={icon}>✓</div>
      <h1 style={h1}>Оплата прошла</h1>
      <p style={sub}>Встреча подтверждена. Чек придёт от «Мой налог».</p>

      <BookingSessionCard type={booking.type} durationMin={booking.durationMin} startsAt={booking.startsAt} />

      {booking.meetingUrl ? (
        <a href={booking.meetingUrl} target="_blank" rel="noreferrer" style={primaryBtn}>Подключиться к встрече</a>
      ) : (
        <>
          <p style={{ ...sub, fontSize: 14, margin: '0 0 10px' }}>Ссылку на видеовстречу готовлю – обновите через минуту.</p>
          <button onClick={onReload} style={ghostBtn}>Обновить</button>
        </>
      )}
      <p style={hint}>Эту же ссылку я продублирую перед сессией.</p>

      {token && (
        <BookingSaveBlock
          cancelToken={token} startsAt={booking.startsAt} durationMin={booking.durationMin}
          type={booking.type} meetingUrl={booking.meetingUrl} tz="Europe/Moscow"
        />
      )}
      {token && <BookingCancelControl cancelToken={token} startsAt={booking.startsAt} onCancelled={onCancelled} />}
    </div>
  );
}

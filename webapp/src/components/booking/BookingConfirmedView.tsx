import { BookingSaveBlock, MEETING_LINK_LATER } from './BookingSaveBlock';
import { BookingCancelControl } from './BookingCancelControl';
import { BookingSessionCard } from './BookingSessionCard';
import type { PublicBooking } from './useBookingByToken';
import { OutcomeBody } from '../paper/OutcomeBody';
import { confirmedCopy } from './confirmedCopy';

/** Бронь CONFIRMED: единственное место, где говорим «Встреча подтверждена». */
export function BookingConfirmedView({ booking, token, onCancelled }: {
  booking: PublicBooking; token: string | null; onCancelled: () => void;
}) {
  // ym-hide-content на собственном корне: cancelToken в BookingSaveBlock —
  // секрет, который Вебвизор визитки писать не должен; защита едет с
  // компонентом, а не с родителем (security#26). Ссылки на встречу здесь нет:
  // страница открывается по токену, а его получает любой, кто записался с
  // чужим контактом (аудит 2026-10) — ссылку присылает владелец.
  const copy = confirmedCopy(booking);
  return (
    <div className="ym-hide-content">
      <OutcomeBody title={copy.title} lead={copy.text}>
        <BookingSessionCard type={booking.type} durationMin={booking.durationMin} startsAt={booking.startsAt} />
        <p className="pa-outcome-lead">{MEETING_LINK_LATER}</p>
        {token && (
          <BookingSaveBlock
            cancelToken={token} startsAt={booking.startsAt} durationMin={booking.durationMin}
            type={booking.type} tz="Europe/Moscow"
          />
        )}
        {token && <BookingCancelControl cancelToken={token} startsAt={booking.startsAt} onCancelled={onCancelled} />}
      </OutcomeBody>
    </div>
  );
}

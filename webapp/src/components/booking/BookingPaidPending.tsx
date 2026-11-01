import { Skeleton } from '../Skeleton';
import { BookingSessionCard } from './BookingSessionCard';
import type { PublicBooking } from './useBookingByToken';
import { CANCEL_SUPPORT_LINK, CANCEL_SUPPORT_HANDLE } from './cancelPolicy';
import { h1, sub } from './bookingPageStyles';
import { icon, ghostBtn } from './bookingPaidStyles';
import { BookingRefreshFailedNote } from './BookingRefreshFailedNote';

/**
 * Оплата принята (подписанный редирект Robokassa), а вебхук ещё не перевёл
 * бронь в CONFIRMED. «Встреча подтверждена» тут нельзя: вебхук мог не прийти
 * или отказать по сумме, и через 15 минут холд отменится (аудит 2026-10-11).
 */
export function BookingPaidPending({ booking, timedOut, refreshFailed, onRetry }: {
  booking: PublicBooking; timedOut: boolean; refreshFailed: boolean; onRetry: () => void;
}) {
  return (
    <>
      <div style={icon}>…</div>
      <h1 style={h1}>{timedOut ? 'Подтверждение задерживается' : 'Оплата принята'}</h1>
      {timedOut ? (
        <p style={sub}>
          Запись пока не подтвердилась. Напишите мне в Telegram, проверю оплату и запись:{' '}
          <a href={CANCEL_SUPPORT_LINK} style={{ color: 'inherit', textDecoration: 'underline' }}>{CANCEL_SUPPORT_HANDLE}</a>.
        </p>
      ) : (
        <p style={sub}>Подтверждаю запись, это занимает меньше минуты. Страница обновится сама.</p>
      )}

      <BookingSessionCard type={booking.type} durationMin={booking.durationMin} startsAt={booking.startsAt} />
      {refreshFailed && <BookingRefreshFailedNote showRetry={!timedOut} onRetry={onRetry} />}

      {timedOut
        ? <button onClick={onRetry} style={ghostBtn}>Проверить ещё раз</button>
        : <Skeleton height={48} radius={12} />}
    </>
  );
}

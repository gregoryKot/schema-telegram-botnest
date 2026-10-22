import { BookingSessionCard } from './BookingSessionCard';
import type { PublicBooking } from './useBookingByToken';
import { CANCEL_SUPPORT_LINK, CANCEL_SUPPORT_HANDLE } from './cancelPolicy';
import { h1, sub } from './bookingPageStyles';
import { icon } from './bookingPaidStyles';
import { Btn } from '../landing-kit';
/** Бронь отменена. При `paid` деньги получены, а брони нет: прямо говорим про возврат. */
export function BookingCancelledView({ paid }: { paid: boolean }) {
  return (
    <>
      <div style={icon}>✓</div>
      <h1 style={h1}>Запись отменена</h1>
      {paid ? (
        <p style={sub}>
          Оплата получена. Напишите мне в Telegram, верну деньги:{' '}
          <a href={CANCEL_SUPPORT_LINK} style={{ color: 'inherit', textDecoration: 'underline' }}>{CANCEL_SUPPORT_HANDLE}</a>.
        </p>
      ) : (
        <p style={sub}>Если оплата уже прошла – напишите мне, верну деньги.</p>
      )}
      <Btn href="/#booking" full radius="btn" size="lg">Записаться снова</Btn>
    </>
  );
}

/** Встреча прошла: ссылка управления из .ics живёт и после сессии, обещать «пришлю ссылку» уже нечего. */
export function BookingCompletedView({ booking }: { booking: PublicBooking }) {
  return (
    <>
      <div style={icon}>✓</div>
      <h1 style={h1}>Встреча прошла</h1>
      <p style={sub}>Спасибо, что пришли. Если захотите продолжить – запишитесь на новое время.</p>
      <BookingSessionCard type={booking.type} durationMin={booking.durationMin} startsAt={booking.startsAt} />
      <Btn href="/#booking" full radius="btn" size="lg">Записаться снова</Btn>
    </>
  );
}

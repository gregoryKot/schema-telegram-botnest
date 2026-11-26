import { BookingSessionCard } from './BookingSessionCard';
import type { PublicBooking } from './useBookingByToken';
import { CANCEL_SUPPORT_LINK, CANCEL_SUPPORT_HANDLE } from './cancelPolicy';
import { OutcomeBody } from '../paper/OutcomeBody';
/** Бронь отменена. При `paid` деньги получены, а брони нет: прямо говорим про возврат. */
export function BookingCancelledView({ paid }: { paid: boolean }) {
  return (
    <OutcomeBody
      title="Запись отменена"
      lead={paid ? (
        <>
          Оплата получена. Напишите мне в Telegram, верну деньги:{' '}
          <a href={CANCEL_SUPPORT_LINK} style={{ color: 'inherit', textDecoration: 'underline' }}>{CANCEL_SUPPORT_HANDLE}</a>.
        </>
      ) : 'Если оплата уже прошла – напишите мне, верну деньги.'}
      action={{ label: 'Записаться снова', href: '/#booking' }}
    />
  );
}

/** Встреча прошла: ссылка управления из .ics живёт и после сессии, обещать «пришлю ссылку» уже нечего. */
export function BookingCompletedView({ booking }: { booking: PublicBooking }) {
  return (
    <OutcomeBody title="Встреча прошла" lead="Спасибо, что пришли. Если захотите продолжить – запишитесь на новое время."
      action={{ label: 'Записаться снова', href: '/#booking' }}>
      <BookingSessionCard type={booking.type} durationMin={booking.durationMin} startsAt={booking.startsAt} />
    </OutcomeBody>
  );
}

import { useEffect, useState } from 'react';
import { BookingConfirmedView } from '../components/booking/BookingConfirmedView';
import { BookingPaidPending } from '../components/booking/BookingPaidPending';
import { BookingPaidSkeleton } from '../components/booking/BookingPaidSkeleton';
import { BookingCancelledView, BookingCompletedView } from '../components/booking/BookingEndedViews';
import { useBookingByToken } from '../components/booking/useBookingByToken';
import { paidPhase } from '../components/booking/paidPageModel';
import { page, h1, sub, backLink } from '../components/booking/bookingPageStyles';
import { icon, primaryBtn } from '../components/booking/bookingPaidStyles';

// Where the client lands after returning from Robokassa. /api/payment/success
// validates the signature and redirects here with ?token=… (the booking's
// self-cancel token). Редирект приходит раньше вебхука ResultURL (или вместо
// него), поэтому экран ветвится по статусу брони: «Встреча подтверждена» —
// только для CONFIRMED, пока HELD — «подтверждаем» с автоповтором запроса.
export function BookingPaidPage() {
  // Capture query params once — we strip the token from the URL below, so we
  // must not re-read it from window.location on later renders.
  const [token] = useState<string | null>(() => new URLSearchParams(window.location.search).get('token'));
  const [failed] = useState<boolean>(() => new URLSearchParams(window.location.search).get('fail') === '1');

  const { booking, loaded, timedOut, reload } = useBookingByToken(token);
  const [cancelledByClient, setCancelledByClient] = useState(false);

  // The token is a capability (view + cancel). Drop it from the visible URL so
  // it doesn't linger in browser history or leak via the Referer to analytics.
  useEffect(() => {
    if (token) window.history.replaceState(window.history.state, '', window.location.pathname);
  }, [token]);

  const phase = cancelledByClient ? 'cancelled' : booking ? paidPhase(booking.status) : 'unknown';

  let body: React.ReactNode;

  if (failed) {
    // Токена на FailURL нет (адрес не подписан), срок холда проверить нечем —
    // поэтому не обещаем, что время ещё держится.
    body = (
      <>
        <div style={icon}>×</div>
        <h1 style={h1}>Оплата не прошла</h1>
        <p style={sub}>Деньги не списаны. Выберите время и попробуйте ещё раз – если оно уже занято, найдётся другое.</p>
        <a href="/#booking" style={primaryBtn}>Вернуться к записи</a>
      </>
    );
  } else if (!loaded) {
    body = <BookingPaidSkeleton />;
  } else if (phase === 'cancelled') {
    body = <BookingCancelledView paid={!!booking?.paid} />;
  } else if (booking && phase === 'confirmed') {
    body = <BookingConfirmedView booking={booking} token={token} onReload={reload} onCancelled={() => setCancelledByClient(true)} />;
  } else if (booking && phase === 'pending') {
    body = <BookingPaidPending booking={booking} timedOut={timedOut} onRetry={reload} />;
  } else if (booking && phase === 'completed') {
    body = <BookingCompletedView booking={booking} />;
  } else {
    body = (
      <>
        <div style={icon}>✓</div>
        <h1 style={h1}>Оплата принята</h1>
        <p style={sub}>Спасибо! Я свяжусь с вами и пришлю ссылку на встречу.</p>
        <a href="/" style={primaryBtn}>На главную</a>
      </>
    );
  }

  return (
    <div style={page}>
      <div className="ym-hide-content" style={inner}>
        {body}
        <a href="/" style={backLink}>← На главную</a>
      </div>
    </div>
  );
}

const inner: React.CSSProperties = { width: '100%', maxWidth: 400, textAlign: 'center' };

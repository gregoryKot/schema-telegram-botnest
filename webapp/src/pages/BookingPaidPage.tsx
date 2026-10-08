import { useEffect, useState } from 'react';
import { api } from '../api';
import { BookingCancelControl } from '../components/booking/BookingCancelControl';
import { BookingSaveBlock } from '../components/booking/BookingSaveBlock';
import { page, h1, sub, backLink } from '../components/booking/bookingPageStyles';

type Booking = { status: string; type: 'INTRO_15' | 'SESSION_50'; startsAt: string; endsAt: string; durationMin: number; meetingUrl: string | null };

const fmt = (iso: string) => {
  const s = new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));
  return s.charAt(0).toUpperCase() + s.slice(1) + ' МСК'; // first letter only, not every word
};

const typeLabel = (t: string) => (t === 'INTRO_15' ? 'Вводная встреча' : 'Сессия');

// Where the client lands after returning from Robokassa. /api/payment/success
// validates the signature and redirects here with ?token=… (the booking's
// self-cancel token), so we can show the confirmed session + meeting link.
export function BookingPaidPage() {
  // Capture query params once — we strip the token from the URL below, so we
  // must not re-read it from window.location on later renders.
  const [token] = useState<string | null>(() => new URLSearchParams(window.location.search).get('token'));
  const [failed] = useState<boolean>(() => new URLSearchParams(window.location.search).get('fail') === '1');

  const [booking, setBooking] = useState<Booking | null>(null);
  // No token → nothing to fetch, so we're already "loaded" from the start.
  const [loaded, setLoaded] = useState(() => !token);
  const [reloadTick, setReloadTick] = useState(0);
  const [cancelled, setCancelled] = useState(false);

  // The token is a capability (view + cancel). Drop it from the visible URL so
  // it doesn't linger in browser history or leak via the Referer to analytics.
  useEffect(() => {
    if (token) window.history.replaceState(window.history.state, '', window.location.pathname);
  }, [token]);

  // Load the booking behind the token. The fetch lives inside the effect and
  // only sets state after `await` (guarded by `alive`), so nothing sets state
  // synchronously in the effect body and deps are complete.
  useEffect(() => {
    if (!token) return; // loaded already true from init — nothing to fetch
    let alive = true;
    api.getBookingByToken(token)
      .then((b) => { if (alive) { setBooking(b); setCancelled(b.status === 'CANCELLED'); } })
      .catch(() => { if (alive) setBooking(null); })
      .finally(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, [token, reloadTick]);

  let body: React.ReactNode;

  if (failed) {
    body = (
      <>
        <div style={icon}>×</div>
        <h1 style={h1}>Оплата не прошла</h1>
        <p style={sub}>Деньги не списаны. Время держится за вами ещё несколько минут – можно попробовать снова.</p>
        <a href="/#booking" style={primaryBtn}>Вернуться к записи</a>
      </>
    );
  } else if (!loaded) {
    body = <p style={{ ...sub, marginTop: 40 }}>Загружаем…</p>;
  } else if (cancelled) {
    body = (
      <>
        <div style={icon}>✓</div>
        <h1 style={h1}>Запись отменена</h1>
        <p style={sub}>Если оплата уже прошла – напишите мне, верну деньги.</p>
        <a href="/#booking" style={primaryBtn}>Записаться снова</a>
      </>
    );
  } else if (booking) {
    body = (
      <>
        <div style={icon}>✓</div>
        <h1 style={h1}>Оплата прошла</h1>
        <p style={sub}>Встреча подтверждена. Чек придёт от «Мой налог».</p>

        <div style={card}>
          <div style={{ fontSize: 13, color: 'var(--text-faint)', marginBottom: 4 }}>{typeLabel(booking.type)} · {booking.durationMin} мин</div>
          <div className="u-h16">{fmt(booking.startsAt)}</div>
        </div>

        {booking.meetingUrl ? (
          <a href={booking.meetingUrl} target="_blank" rel="noreferrer" style={primaryBtn}>Подключиться к встрече</a>
        ) : (
          <>
            <p style={{ ...sub, fontSize: 14, margin: '0 0 10px' }}>Ссылку на видеовстречу готовлю – обновите через минуту.</p>
            <button onClick={() => setReloadTick(t => t + 1)} style={ghostBtn}>Обновить</button>
          </>
        )}
        <p style={hint}>Эту же ссылку я продублирую перед сессией.</p>

        {token && (
          <BookingSaveBlock
            cancelToken={token} startsAt={booking.startsAt} durationMin={booking.durationMin}
            type={booking.type} meetingUrl={booking.meetingUrl} tz="Europe/Moscow"
          />
        )}
        {token && (
          <BookingCancelControl cancelToken={token} startsAt={booking.startsAt} onCancelled={() => setCancelled(true)} />
        )}
      </>
    );
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
      <div style={inner}>
        {body}
        <a href="/" style={backLink}>← На главную</a>
      </div>
    </div>
  );
}

// ── styles (page/h1/sub/backLink — в bookingPageStyles.ts) ─────────────────────────────────────────
const inner: React.CSSProperties = { width: '100%', maxWidth: 400, textAlign: 'center' };
const icon: React.CSSProperties = {
  width: 56, height: 56, margin: '0 auto 20px', borderRadius: '50%',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'rgba(var(--accent-rgb),0.10)', color: 'var(--accent)', fontSize: 28,
};
const card: React.CSSProperties = { background: 'rgba(var(--fg-rgb),0.04)', border: '1px solid var(--line)', borderRadius: 'var(--r-14)', padding: '16px 18px', margin: '0 0 18px' };
const primaryBtn: React.CSSProperties = {
  display: 'block', width: '100%', boxSizing: 'border-box', textAlign: 'center', padding: '14px',
  fontSize: 15, fontWeight: 600, fontFamily: 'inherit', background: 'var(--accent)', color: '#fff',
  border: 'none', borderRadius: 'var(--r-12)', cursor: 'pointer', textDecoration: 'none',
};
const ghostBtn: React.CSSProperties = { ...primaryBtn, background: 'transparent', color: 'var(--accent)', border: '1.5px solid var(--accent)' };
const hint: React.CSSProperties = { fontSize: 13, color: 'var(--text-faint)', lineHeight: 1.6, margin: '14px 0 22px' };

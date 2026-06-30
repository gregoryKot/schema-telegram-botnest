import { useEffect, useState } from 'react';
import { api } from '../api';

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
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  const failed = params.get('fail') === '1';

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const load = () => {
    if (!token) { setLoaded(true); return; }
    api.getBookingByToken(token)
      .then((b) => { setBooking(b); setCancelled(b.status === 'CANCELLED'); })
      .catch(() => setBooking(null))
      .finally(() => setLoaded(true));
  };
  useEffect(load, [token]);

  const doCancel = async () => {
    if (!token) return;
    try {
      await api.cancelBooking(token);
      setCancelled(true);
      setConfirmCancel(false);
    } catch (err) {
      setConfirmCancel(false);
      setCancelError(
        err instanceof Error && err.message === 'CANCEL_TOO_LATE'
          ? 'Отменить онлайн можно не позднее чем за 24 часа до встречи. Напишите мне в Telegram — решим.'
          : 'Не получилось отменить. Попробуйте ещё раз или напишите мне.',
      );
    }
  };

  let body: React.ReactNode;

  if (failed) {
    body = (
      <>
        <div style={icon}>😕</div>
        <h1 style={h1}>Оплата не прошла</h1>
        <p style={sub}>Деньги не списаны. Слот держится за вами ещё несколько минут — можно попробовать снова.</p>
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
        <p style={sub}>Если оплата уже прошла — напишите мне, верну средства.</p>
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
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>{fmt(booking.startsAt)}</div>
        </div>

        {booking.meetingUrl ? (
          <a href={booking.meetingUrl} target="_blank" rel="noreferrer" style={primaryBtn}>Подключиться к встрече</a>
        ) : (
          <>
            <p style={{ ...sub, fontSize: 14, margin: '0 0 10px' }}>Ссылку на видеовстречу готовим — обновите через минуту.</p>
            <button onClick={load} style={ghostBtn}>Обновить</button>
          </>
        )}
        <p style={hint}>Эту же ссылку я продублирую перед сессией.</p>

        {cancelError && <p style={{ ...sub, fontSize: 13, color: 'var(--accent-red, #c0392b)', margin: '0 0 14px' }}>{cancelError}</p>}
        {!confirmCancel ? (
          <button onClick={() => setConfirmCancel(true)} style={textLink}>Отменить запись</button>
        ) : (
          <div style={{ marginTop: 4 }}>
            <p style={{ ...sub, fontSize: 14, margin: '0 0 12px' }}>Точно отменить эту встречу?</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={doCancel} style={dangerBtn}>Да, отменить</button>
              <button onClick={() => setConfirmCancel(false)} style={ghostSmall}>Оставить</button>
            </div>
          </div>
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

// ── styles (match the site's tokens) ─────────────────────────────────────────
const page: React.CSSProperties = {
  background: 'var(--bg)', color: 'var(--text)', minHeight: '100dvh',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px',
};
const inner: React.CSSProperties = { width: '100%', maxWidth: 400, textAlign: 'center' };
const icon: React.CSSProperties = {
  width: 56, height: 56, margin: '0 auto 20px', borderRadius: '50%',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'rgba(var(--accent-rgb,77,71,153),0.10)', color: 'var(--accent)', fontSize: 28,
};
const h1: React.CSSProperties = { fontFamily: 'var(--serif)', fontSize: 'clamp(26px,6vw,34px)', fontWeight: 400, lineHeight: 1.15, letterSpacing: '-.01em', margin: '0 0 10px' };
const sub: React.CSSProperties = { fontSize: 15, color: 'var(--text-sub)', lineHeight: 1.7, margin: '0 0 24px' };
const card: React.CSSProperties = { background: 'rgba(var(--fg-rgb),0.04)', border: '1px solid var(--line)', borderRadius: 14, padding: '16px 18px', margin: '0 0 18px' };
const primaryBtn: React.CSSProperties = {
  display: 'block', width: '100%', boxSizing: 'border-box', textAlign: 'center', padding: '14px',
  fontSize: 15, fontWeight: 600, fontFamily: 'inherit', background: 'var(--accent)', color: '#fff',
  border: 'none', borderRadius: 12, cursor: 'pointer', textDecoration: 'none',
};
const ghostBtn: React.CSSProperties = { ...primaryBtn, background: 'transparent', color: 'var(--accent)', border: '1.5px solid var(--accent)' };
const hint: React.CSSProperties = { fontSize: 13, color: 'var(--text-faint)', lineHeight: 1.6, margin: '14px 0 22px' };
const textLink: React.CSSProperties = { background: 'none', border: 'none', color: 'var(--text-faint)', fontSize: 14, fontFamily: 'inherit', cursor: 'pointer', textDecoration: 'underline' };
const dangerBtn: React.CSSProperties = { padding: '10px 18px', fontSize: 14, fontFamily: 'inherit', cursor: 'pointer', borderRadius: 10, border: '1.5px solid var(--accent-red, #c0392b)', background: 'transparent', color: 'var(--accent-red, #c0392b)' };
const ghostSmall: React.CSSProperties = { padding: '10px 18px', fontSize: 14, fontFamily: 'inherit', cursor: 'pointer', borderRadius: 10, border: '1.5px solid var(--line-strong)', background: 'transparent', color: 'var(--text-sub)' };
const backLink: React.CSSProperties = { display: 'inline-block', marginTop: 32, fontSize: 13, color: 'var(--text-faint)', textDecoration: 'none' };

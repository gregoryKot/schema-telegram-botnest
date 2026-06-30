import { useEffect, useState } from 'react';
import { api } from '../api';

type Booking = { status: string; type: 'INTRO_15' | 'SESSION_50'; startsAt: string; endsAt: string; durationMin: number; meetingUrl: string | null };

const fmt = (iso: string) => {
  const s = new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));
  return s.charAt(0).toUpperCase() + s.slice(1) + ' МСК'; // only the first letter, not every word
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
    try { await api.cancelBooking(token); setCancelled(true); } catch { /* ignore */ }
    setConfirmCancel(false);
  };

  const wrap: React.CSSProperties = { background: 'var(--bg)', color: 'var(--text)', minHeight: '100dvh' };
  const inner: React.CSSProperties = { maxWidth: 460, margin: '0 auto', padding: '48px 20px 60px' };
  const btn: React.CSSProperties = {
    display: 'block', width: '100%', boxSizing: 'border-box', textAlign: 'center', padding: '15px',
    fontSize: 16, fontWeight: 700, fontFamily: 'inherit', background: 'var(--accent)', color: '#fff',
    border: 'none', borderRadius: 12, cursor: 'pointer', textDecoration: 'none',
  };

  let body: React.ReactNode;

  if (failed) {
    body = (
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <div style={{ fontSize: 52, marginBottom: 16 }}>😕</div>
        <h1 style={{ fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 400, margin: '0 0 10px' }}>Оплата не прошла</h1>
        <p style={{ color: 'var(--text-sub)', fontSize: 16, lineHeight: 1.6, margin: '0 0 28px' }}>
          Деньги не списаны. Слот держится за вами ещё несколько минут — можно попробовать снова.
        </p>
        <a href="/#booking" style={btn}>Вернуться к записи</a>
      </div>
    );
  } else if (!loaded) {
    body = <p style={{ color: 'var(--text-sub)', textAlign: 'center', padding: '48px 0' }}>Загружаем…</p>;
  } else if (cancelled) {
    body = (
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <div style={{ fontSize: 52, marginBottom: 16 }}>✓</div>
        <h1 style={{ fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 400, margin: '0 0 10px' }}>Запись отменена</h1>
        <p style={{ color: 'var(--text-sub)', fontSize: 16, lineHeight: 1.6, margin: '0 0 28px' }}>
          Если оплата уже прошла — напишите мне, верну средства.
        </p>
        <a href="/#booking" style={btn}>Записаться снова</a>
      </div>
    );
  } else if (booking) {
    body = (
      <div style={{ paddingTop: 16 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>✅</div>
          <h1 style={{ fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 400, margin: '0 0 8px' }}>Оплата прошла</h1>
          <p style={{ color: 'var(--text-sub)', fontSize: 16, lineHeight: 1.6, margin: 0 }}>
            Встреча подтверждена. Чек придёт от «Мой налог».
          </p>
        </div>

        <div style={{ background: 'rgba(var(--fg-rgb),0.04)', border: '1.5px solid var(--line)', borderRadius: 14, padding: '18px 18px', marginBottom: 20 }}>
          <div style={{ fontSize: 13, color: 'var(--text-faint)', marginBottom: 4 }}>{typeLabel(booking.type)} · {booking.durationMin} мин</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{fmt(booking.startsAt)}</div>
        </div>

        {booking.meetingUrl ? (
          <a href={booking.meetingUrl} target="_blank" rel="noreferrer" style={{ ...btn, marginBottom: 12 }}>Подключиться к встрече</a>
        ) : (
          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <p style={{ color: 'var(--text-sub)', fontSize: 14, lineHeight: 1.6, margin: '0 0 10px' }}>
              Ссылку на видеовстречу готовим — обновите страницу через минуту.
            </p>
            <button onClick={load} style={{ ...btn, background: 'transparent', color: 'var(--accent)', border: '1.5px solid var(--accent)' }}>Обновить</button>
          </div>
        )}
        <p style={{ fontSize: 13, color: 'var(--text-faint)', textAlign: 'center', lineHeight: 1.6, margin: '4px 0 24px' }}>
          Эту же ссылку я продублирую перед сессией. Сохраните страницу в закладки.
        </p>

        {!confirmCancel ? (
          <button onClick={() => setConfirmCancel(true)} style={{ display: 'block', margin: '0 auto', background: 'none', border: 'none', color: 'var(--text-faint)', fontSize: 14, fontFamily: 'inherit', cursor: 'pointer', textDecoration: 'underline' }}>
            Отменить запись
          </button>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 14, color: 'var(--text-sub)', margin: '0 0 12px' }}>Точно отменить эту встречу?</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={doCancel} style={{ padding: '10px 18px', fontSize: 14, fontFamily: 'inherit', cursor: 'pointer', borderRadius: 10, border: '1.5px solid var(--accent-red, #c0392b)', background: 'transparent', color: 'var(--accent-red, #c0392b)' }}>Да, отменить</button>
              <button onClick={() => setConfirmCancel(false)} style={{ padding: '10px 18px', fontSize: 14, fontFamily: 'inherit', cursor: 'pointer', borderRadius: 10, border: '1.5px solid var(--line-strong)', background: 'transparent', color: 'var(--text-sub)' }}>Оставить</button>
            </div>
          </div>
        )}
      </div>
    );
  } else {
    // No / unknown token — generic reassurance.
    body = (
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <div style={{ fontSize: 52, marginBottom: 16 }}>✅</div>
        <h1 style={{ fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 400, margin: '0 0 10px' }}>Оплата принята</h1>
        <p style={{ color: 'var(--text-sub)', fontSize: 16, lineHeight: 1.6, margin: '0 0 28px' }}>
          Спасибо! Я свяжусь с вами и пришлю ссылку на встречу.
        </p>
        <a href="/" style={btn}>На главную</a>
      </div>
    );
  }

  return (
    <div style={wrap}>
      <div style={inner}>
        <a href="/" style={{ color: 'var(--text-sub)', fontSize: 15, textDecoration: 'none' }}>← На главную</a>
        {body}
      </div>
    </div>
  );
}

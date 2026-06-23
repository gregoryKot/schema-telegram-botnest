import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import type { AvailabilityRule, AdminBooking } from '../api';

const DAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const DAYS_FULL = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
const KEY_STORE = 'booking_admin_key';

const card: React.CSSProperties = {
  background: 'var(--bg-rail)', border: '1px solid var(--line)', borderRadius: 14, padding: 20, marginBottom: 16,
};
const btn: React.CSSProperties = {
  padding: '9px 16px', fontSize: 14, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
  background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 10,
};
const btnGhost: React.CSSProperties = {
  ...btn, background: 'transparent', color: 'var(--text-sub)', border: '1.5px solid var(--line-strong)',
};
const input: React.CSSProperties = {
  padding: '8px 12px', fontSize: 14, fontFamily: 'inherit', background: 'rgba(var(--fg-rgb),0.04)',
  border: '1.5px solid var(--line)', borderRadius: 8, color: 'var(--text)', outline: 'none',
};

const fmtTime = new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export function BookingAdminPage() {
  const [key, setKey] = useState<string>(() => localStorage.getItem(KEY_STORE) ?? '');
  const [authed, setAuthed] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [keyError, setKeyError] = useState(false);
  const [rules, setRules] = useState<AvailabilityRule[]>([]);
  const [bookings, setBookings] = useState<AdminBooking[]>([]);

  const reload = useCallback(async (k: string) => {
    const [r, b] = await Promise.all([api.adminListRules(k), api.adminListBookings(k)]);
    setRules(r); setBookings(b);
  }, []);

  useEffect(() => {
    if (!key) return;
    reload(key).then(() => setAuthed(true)).catch(() => { setAuthed(false); localStorage.removeItem(KEY_STORE); setKey(''); });
  }, [key, reload]);

  const tryKey = async () => {
    setKeyError(false);
    try {
      await api.adminListRules(keyInput);
      localStorage.setItem(KEY_STORE, keyInput);
      setKey(keyInput);
    } catch { setKeyError(true); }
  };

  if (!authed) return (
    <div style={{ maxWidth: 420, margin: '80px auto', padding: '0 20px', fontFamily: 'var(--sans)' }}>
      <h1 style={{ fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 400, color: 'var(--text)' }}>Админка записи</h1>
      <p style={{ color: 'var(--text-sub)', fontSize: 15 }}>Введите ключ доступа (ADMIN_BOOKING_KEY).</p>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <input style={{ ...input, flex: 1 }} type="password" value={keyInput} onChange={e => setKeyInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && tryKey()} placeholder="Ключ" />
        <button style={btn} onClick={tryKey}>Войти</button>
      </div>
      {keyError && <p style={{ color: 'var(--accent-red)', fontSize: 13, marginTop: 8 }}>Неверный ключ</p>}
    </div>
  );

  return (
    <div style={{ maxWidth: 760, margin: '40px auto', padding: '0 20px 80px', fontFamily: 'var(--sans)' }}>
      <h1 style={{ fontFamily: 'var(--serif)', fontSize: 30, fontWeight: 400, color: 'var(--text)', marginBottom: 24 }}>Админка записи</h1>
      <ScheduleManager rules={rules} onChange={() => reload(key)} adminKey={key} />
      <BookingsManager bookings={bookings} onChange={() => reload(key)} adminKey={key} />
    </div>
  );
}

// ── Schedule ───────────────────────────────────────────────────────────────

function ScheduleManager({ rules, onChange, adminKey }: { rules: AvailabilityRule[]; onChange: () => void; adminKey: string }) {
  const [day, setDay] = useState(1);
  const [start, setStart] = useState('10:00');
  const [end, setEnd] = useState('19:00');
  const [duration, setDuration] = useState(50);
  const [buffer, setBuffer] = useState(10);

  const add = async () => {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    await api.adminCreateRule(adminKey, {
      dayOfWeek: day, startHour: sh, startMinute: sm, endHour: eh, endMinute: em,
      sessionDuration: duration, bufferMin: buffer,
    });
    onChange();
  };

  return (
    <section style={card}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginTop: 0, marginBottom: 16 }}>Расписание</h2>
      {rules.length === 0 && <p style={{ color: 'var(--text-faint)', fontSize: 14 }}>Пока нет правил. Добавьте слоты ниже.</p>}
      {rules.map(r => (
        <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--line)', opacity: r.isActive ? 1 : 0.45 }}>
          <strong style={{ width: 36, color: 'var(--text)' }}>{DAYS[r.dayOfWeek]}</strong>
          <span style={{ flex: 1, color: 'var(--text-sub)', fontSize: 14 }}>
            {pad(r.startHour)}:{pad(r.startMinute)}–{pad(r.endHour)}:{pad(r.endMinute)} · {r.sessionDuration} мин (+{r.bufferMin})
          </span>
          <button style={{ ...btnGhost, padding: '4px 10px', fontSize: 12 }} onClick={() => api.adminToggleRule(adminKey, r.id, !r.isActive).then(onChange)}>
            {r.isActive ? 'Выкл' : 'Вкл'}
          </button>
          <button style={{ ...btnGhost, padding: '4px 10px', fontSize: 12, color: 'var(--accent-red)' }} onClick={() => api.adminDeleteRule(adminKey, r.id).then(onChange)}>✕</button>
        </div>
      ))}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 16 }}>
        <select style={input} value={day} onChange={e => setDay(Number(e.target.value))}>
          {DAYS_FULL.map((d, i) => <option key={i} value={i}>{d}</option>)}
        </select>
        <input style={input} type="time" value={start} onChange={e => setStart(e.target.value)} />
        <span style={{ color: 'var(--text-faint)' }}>–</span>
        <input style={input} type="time" value={end} onChange={e => setEnd(e.target.value)} />
        <label style={{ fontSize: 13, color: 'var(--text-faint)' }}>сессия<input style={{ ...input, width: 56, marginLeft: 4 }} type="number" value={duration} onChange={e => setDuration(Number(e.target.value))} /></label>
        <label style={{ fontSize: 13, color: 'var(--text-faint)' }}>буфер<input style={{ ...input, width: 56, marginLeft: 4 }} type="number" value={buffer} onChange={e => setBuffer(Number(e.target.value))} /></label>
        <button style={btn} onClick={add}>Добавить</button>
      </div>
    </section>
  );
}

// ── Bookings ───────────────────────────────────────────────────────────────

function BookingsManager({ bookings, onChange, adminKey }: { bookings: AdminBooking[]; onChange: () => void; adminKey: string }) {
  return (
    <section style={card}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginTop: 0, marginBottom: 16 }}>Ближайшие записи</h2>
      {bookings.length === 0 && <p style={{ color: 'var(--text-faint)', fontSize: 14 }}>Записей нет.</p>}
      {bookings.map(b => (
        <div key={b.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <strong style={{ color: 'var(--text)', fontSize: 14 }}>{fmtTime.format(new Date(b.startsAt))} МСК</strong>
            <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 100, background: statusBg(b.status), color: '#fff' }}>{statusLabel(b.status)}</span>
            <span style={{ flex: 1 }} />
            {b.status === 'HELD' && <button style={{ ...btn, padding: '5px 12px', fontSize: 13 }} onClick={() => api.adminConfirm(adminKey, b.id).then(onChange)}>Подтвердить</button>}
            {b.status !== 'CANCELLED' && <button style={{ ...btnGhost, padding: '5px 12px', fontSize: 13, color: 'var(--accent-red)' }} onClick={() => api.cancelBooking(b.cancelToken).then(onChange)}>Отменить</button>}
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-sub)', marginTop: 6 }}>
            {b.clientName} · {b.clientContact}{b.message ? ` · «${b.message}»` : ''}
          </div>
        </div>
      ))}
    </section>
  );
}

function pad(n: number) { return String(n).padStart(2, '0'); }
function statusLabel(s: string) { return { HELD: 'Ожидает', CONFIRMED: 'Подтверждена', CANCELLED: 'Отменена', COMPLETED: 'Завершена' }[s] ?? s; }
function statusBg(s: string) { return { HELD: '#b8860b', CONFIRMED: 'var(--accent)', CANCELLED: '#999', COMPLETED: '#4a6335' }[s] ?? '#999'; }

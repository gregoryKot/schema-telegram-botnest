import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api';
import type { AdminBooking } from '../../api';
import { bookingContactLine } from './bookingContactLine';
import { card, btn, btnGhost } from './shared';
import { useSaveFeedback } from './useSaveFeedback';

const fmtTime = new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

type Filter = 'upcoming' | 'cancelled' | 'past' | 'all';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'upcoming', label: 'Будущие' },
  { id: 'cancelled', label: 'Отменённые' },
  { id: 'past', label: 'Прошедшие' },
  { id: 'all', label: 'Все' },
];

/** Админка записей: список по фильтру, «Подтвердить» и «Отменить» (в любой срок). */
export function BookingsManager({ adminKey }: { adminKey: string }) {
  const [filter, setFilter] = useState<Filter>('upcoming');
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  // Сбой ≠ пусто: «Записей нет.» на отказе запроса читается как «записей
  // правда нет», хотя запрос мог отвалиться из-за неверного ключа или сети.
  const [bookingsFailed, setBookingsFailed] = useState(false);
  const { guard, feedback } = useSaveFeedback({ saved: 'Готово ✓' });

  const load = useCallback(() => {
    setBookingsFailed(false);
    api.adminListBookings(adminKey, filter).then(setBookings).catch(() => setBookingsFailed(true));
  }, [adminKey, filter]);
  // Действие над бронью: ошибка видна текстом (раньше промис без catch уходил
  // в unhandledRejection, и владелец не видел, что ничего не произошло).
  const act = (failPrefix: string, run: () => Promise<unknown>) =>
    guard(async () => { await run(); load(); }, failPrefix);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- намеренно: загрузка/сброс состояния при монтировании или смене зависимости (fetch-эффект); рефактор на key/data-layer — отдельная задача
  useEffect(() => { load(); }, [load]);

  return (
    <section style={card}>
      <h2 style={{ fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 400, letterSpacing: '-0.01em', color: 'var(--text)', marginTop: 0, marginBottom: 14 }}>Записи</h2>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {FILTERS.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} style={{
            padding: '6px 14px', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', borderRadius: 100,
            background: filter === f.id ? 'var(--accent)' : 'transparent', color: filter === f.id ? '#fff' : 'var(--text-sub)',
            border: `1.5px solid ${filter === f.id ? 'var(--accent)' : 'var(--line-strong)'}`,
          }}>{f.label}</button>
        ))}
      </div>
      {feedback}
      {/* Сбой ≠ пусто: «Записей нет.» — только на реально пустом ответе. */}
      {bookingsFailed && <p role="alert" style={{ color: 'var(--accent-red)', fontSize: 14 }}>Не удалось загрузить записи — возможно, неверный админ-ключ или нет соединения.</p>}
      {!bookingsFailed && bookings.length === 0 && <p className="u-faint14">Записей нет.</p>}
      {bookings.map(b => (
        <div key={b.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-10)', flexWrap: 'wrap' }}>
            <strong style={{ color: 'var(--text)', fontSize: 14 }}>{fmtTime.format(new Date(b.startsAt))} МСК</strong>
            <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 100, background: statusBg(b.status), color: '#fff' }}>{statusLabel(b.status)}</span>
            <span className="u-flex1" />
            {b.status === 'HELD' && <button style={{ ...btn, padding: '5px 12px', fontSize: 13 }} onClick={() => act('Не удалось подтвердить запись', () => api.adminConfirm(adminKey, b.id))}>Подтвердить</button>}
            {b.status !== 'CANCELLED' && b.status !== 'COMPLETED' && <button style={{ ...btnGhost, padding: '5px 12px', fontSize: 13, color: 'var(--accent-red)' }} onClick={() => act('Не удалось отменить запись', () => api.adminCancel(adminKey, b.id))}>Отменить</button>}
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-sub)', marginTop: 6 }}>
            {bookingContactLine(b)}
          </div>
        </div>
      ))}
    </section>
  );
}

function statusLabel(s: string) { return { HELD: 'Ожидает', CONFIRMED: 'Подтверждена', CANCELLED: 'Отменена', COMPLETED: 'Завершена' }[s] ?? s; }
function statusBg(s: string) { return { HELD: 'var(--c-amber)', CONFIRMED: 'var(--accent)', CANCELLED: '#999', COMPLETED: 'var(--accent-green)' }[s] ?? '#999'; }

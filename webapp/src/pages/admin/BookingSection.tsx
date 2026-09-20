import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../../api';
import type {
  AvailabilityRule,
  AdminBooking,
  SessionOption,
  AdminBookingStatus,
} from '../../api';
import { useAsyncData } from '../../hooks/useAsyncData';
import { card, btn, btnGhost, input } from './shared';
import { ScheduleSection } from './ScheduleSection';

const fmtTime = new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Booking admin tab: integrations status, prices, schedule, bookings list. */
export function BookingSection({ adminKey }: { adminKey: string }) {
  const fetcher = useCallback(() => api.adminListRules(adminKey), [adminKey]);
  const { data: rules, reload, failed } = useAsyncData<AvailabilityRule[]>(fetcher, []);

  return (
    <>
      <IntegrationStatus adminKey={adminKey} />
      <PricesManager adminKey={adminKey} />
      <SubPricesManager adminKey={adminKey} />
      <ScheduleSection rules={rules} rulesFailed={failed} onChange={reload} adminKey={adminKey} />
      <BookingsManager adminKey={adminKey} />
    </>
  );
}

// ── Integration status ──────────────────────────────────────────────────────

const StatusDot = ({ on }: { on: boolean }) => (
  <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 9, marginRight: 7, background: on ? '#4a6335' : '#b8860b' }} />
);
const StatusRow = ({ label, on, note, error }: { label: string; on: boolean; note?: string; error?: string }) => ( // error красной пометкой перекрывает note (2026-09-13)
  <div style={{ display: 'flex', alignItems: 'center', fontSize: 14, padding: '5px 0' }}>
    <StatusDot on={on} /><span className="u-fg">{label}</span>
    <span className="u-flex1" />
    <span style={{ color: error ? 'var(--accent-red)' : on ? 'var(--text-sub)' : '#b8860b', fontSize: 13 }}>{error ? `чтение не работает: ${error}` : on ? (note ?? 'вкл') : 'выкл'}</span>
  </div>
);

function IntegrationStatus({ adminKey }: { adminKey: string }) {
  const [s, setS] = useState<AdminBookingStatus | null>(null);
  useEffect(() => { api.adminStatus(adminKey).then(setS).catch(() => setS(null)); }, [adminKey]);
  if (!s) return null;
  return (
    <section style={card}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginTop: 0, marginBottom: 12 }}>Интеграции</h2>
      <StatusRow label="Zoom (видео-ссылки)" on={!!s.zoom} note="вкл" />
      {!s.zoom && (
        <div style={{ fontSize: 12, color: 'var(--text-faint)', margin: '2px 0 8px 16px', lineHeight: 1.5 }}>
          Без Zoom выдаётся Jitsi-комната. Проверьте переменные:
          ACCOUNT_ID {s.zoomVars?.accountId ? '✓' : '✗'} · CLIENT_ID {s.zoomVars?.clientId ? '✓' : '✗'} · CLIENT_SECRET {s.zoomVars?.clientSecret ? '✓' : '✗'}
        </div>
      )}
      <StatusRow label="Robokassa (оплата)" on={!!s.robokassa} note={s.robokassaTest ? 'тест-режим' : 'боевой'} />
      <StatusRow label="Apple Calendar" on={!!s.appleCalendar} note={s.appleCalendar ? `вкл · занято: ${s.calendarBusyCount ?? '?'}` : undefined} error={s.calendarReadError ?? undefined} />
      {s.appleCalendar && (
        <div style={{ fontSize: 12, color: 'var(--text-faint)', margin: '2px 0 8px 16px', lineHeight: 1.5 }}>
          {Array.isArray(s.calendarNames) && s.calendarNames.length > 0
            ? <>Календари в скане: {s.calendarNames.join(', ')}</>
            : <>Календари не найдены — проверьте APPLE_ID / APPLE_APP_PASSWORD.</>}
        </div>
      )}
      {s.appleCalendar && !s.calendarBlocking && (s.calendarBusyCount ?? 0) > 0 && (
        <div style={{ fontSize: 12, color: 'var(--text-faint)', margin: '2px 0 8px 16px', lineHeight: 1.5 }}>
          Календарь видит {s.calendarBusyCount} занятых интервалов, но слоты пока НЕ блокируются.
          Включите переменную CALENDAR_BLOCK_SLOTS=true, чтобы нельзя было записаться поверх встреч.
        </div>
      )}
      {s.appleCalendar && s.calendarBlocking && (
        <div style={{ fontSize: 12, color: 'var(--text-faint)', margin: '2px 0 8px 16px', lineHeight: 1.5 }}>
          Блокировка слотов по календарю включена — занятое время скрывается из записи.
        </div>
      )}
      <StatusRow label="Резерв уведомлений на почту" on={!!s.emailFallback} />
      <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 10 }}>
        Запись: {s.siteUrl} · Приложение: {s.appUrl}
      </div>
    </section>
  );
}

// Сохранить + показать успех/ошибку (было без try/catch — провал молча тонул).
function useSaveFeedback() {
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Таймер сброса «✓» чистится при анмаунте: без этого setState стрелял по
  // снятому компоненту (в CI это роняло vitest: «window is not defined»).
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const guard = async (fn: () => Promise<void>) => {
    setError(null);
    try {
      await fn(); setSaved(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setSaved(false), 1500);
    }
    catch (e) { setError(e instanceof Error ? e.message : 'Не удалось сохранить цену'); }
  };
  const feedback = error
    ? <p style={{ fontSize: 13, color: 'var(--accent-red)', margin: '8px 0 0' }}>{error}</p>
    : saved ? <p style={{ fontSize: 13, color: '#4a6335', margin: '8px 0 0' }}>Цена сохранена ✓</p> : null;
  return { guard, feedback };
}

function PricesManager({ adminKey }: { adminKey: string }) {
  const [opts, setOpts] = useState<SessionOption[]>([]);
  const [draft, setDraft] = useState<Record<string, number>>({});
  const { guard, feedback } = useSaveFeedback();
  const load = useCallback(() => {
    api.adminGetPrices(adminKey).then((o) => {
      setOpts(o);
      setDraft(Object.fromEntries(o.map((x) => [x.type, x.price])));
    }).catch(() => setOpts([]));
  }, [adminKey]);
  useEffect(() => { load(); }, [load]);
  const paid = opts.filter((o) => o.type !== 'INTRO_15'); // знакомство бесплатно, не редактируется
  const save = (type: string) =>
    guard(() => api.adminSetPrice(adminKey, type as 'SESSION_50', draft[type] ?? 0).then(() => load()));
  return (
    <section style={card}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginTop: 0, marginBottom: 14 }}>Цены</h2>
      {paid.map((o) => (
        <div key={o.type} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-10)', padding: '6px 0', flexWrap: 'wrap' }}>
          <span style={{ flex: 1, color: 'var(--text)', fontSize: 14 }}>{o.label} · {o.durationMin} мин</span>
          <input type="number" min={0} value={draft[o.type] ?? 0}
            onChange={(e) => setDraft({ ...draft, [o.type]: Math.max(0, Math.round(Number(e.target.value))) })}
            style={{ ...input, width: 110 }} />
          <span className="u-faint">₽</span>
          <button style={btn} onClick={() => save(o.type)}>Сохранить</button>
        </div>
      ))}
      {feedback}
      <p style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 10 }}>Знакомство всегда бесплатное. Цена применяется к новым записям сразу.</p>
    </section>
  );
}

function SubPricesManager({ adminKey }: { adminKey: string }) {
  const [opts, setOpts] = useState<{ period: 'month' | 'year'; price: number }[]>([]);
  const [draft, setDraft] = useState<Record<string, number>>({});
  const { guard, feedback } = useSaveFeedback();
  const load = useCallback(() => {
    api.adminGetSubPrices(adminKey).then((o) => {
      setOpts(o);
      setDraft(Object.fromEntries(o.map((x) => [x.period, x.price])));
    }).catch(() => setOpts([]));
  }, [adminKey]);
  useEffect(() => { load(); }, [load]);
  const save = (period: 'month' | 'year') =>
    guard(() => api.adminSetSubPrice(adminKey, period, draft[period] ?? 0).then(() => load()));
  return (
    <section style={card}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginTop: 0, marginBottom: 14 }}>Подписка</h2>
      {opts.map((o) => (
        <div key={o.period} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-10)', padding: '6px 0', flexWrap: 'wrap' }}>
          <span style={{ flex: 1, color: 'var(--text)', fontSize: 14 }}>{o.period === 'year' ? 'Год' : 'Месяц'}</span>
          <input type="number" min={1} value={draft[o.period] ?? 0}
            onChange={(e) => setDraft({ ...draft, [o.period]: Math.max(1, Math.round(Number(e.target.value))) })}
            style={{ ...input, width: 110 }} />
          <span className="u-faint">₽</span>
          <button style={btn} onClick={() => save(o.period)}>Сохранить</button>
        </div>
      ))}
      {feedback}
      <p style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 10 }}>Авто-списание раз в период. Требует подключения услуги рекуррентных платежей у Robokassa.</p>
    </section>
  );
}

// ── Bookings ───────────────────────────────────────────────────────────────

type Filter = 'upcoming' | 'cancelled' | 'past' | 'all';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'upcoming', label: 'Будущие' },
  { id: 'cancelled', label: 'Отменённые' },
  { id: 'past', label: 'Прошедшие' },
  { id: 'all', label: 'Все' },
];

function BookingsManager({ adminKey }: { adminKey: string }) {
  const [filter, setFilter] = useState<Filter>('upcoming');
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  // Сбой ≠ пусто: «Записей нет.» на отказе запроса читается как «записей
  // правда нет», хотя запрос мог отвалиться из-за неверного ключа или сети.
  const [bookingsFailed, setBookingsFailed] = useState(false);

  const load = useCallback(() => {
    setBookingsFailed(false);
    api.adminListBookings(adminKey, filter).then(setBookings).catch(() => setBookingsFailed(true));
  }, [adminKey, filter]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- намеренно: загрузка/сброс состояния при монтировании или смене зависимости (fetch-эффект); рефактор на key/data-layer — отдельная задача
  useEffect(() => { load(); }, [load]);

  return (
    <section style={card}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginTop: 0, marginBottom: 14 }}>Записи</h2>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {FILTERS.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} style={{
            padding: '6px 14px', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', borderRadius: 100,
            background: filter === f.id ? 'var(--accent)' : 'transparent', color: filter === f.id ? '#fff' : 'var(--text-sub)',
            border: `1.5px solid ${filter === f.id ? 'var(--accent)' : 'var(--line-strong)'}`,
          }}>{f.label}</button>
        ))}
      </div>
      {/* Сбой ≠ пусто: «Записей нет.» — только на реально пустом ответе. */}
      {bookingsFailed && <p role="alert" style={{ color: 'var(--accent-red)', fontSize: 14 }}>Не удалось загрузить записи — возможно, неверный админ-ключ или нет соединения.</p>}
      {!bookingsFailed && bookings.length === 0 && <p className="u-faint14">Записей нет.</p>}
      {bookings.map(b => (
        <div key={b.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-10)', flexWrap: 'wrap' }}>
            <strong style={{ color: 'var(--text)', fontSize: 14 }}>{fmtTime.format(new Date(b.startsAt))} МСК</strong>
            <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 100, background: statusBg(b.status), color: '#fff' }}>{statusLabel(b.status)}</span>
            <span className="u-flex1" />
            {b.status === 'HELD' && <button style={{ ...btn, padding: '5px 12px', fontSize: 13 }} onClick={() => api.adminConfirm(adminKey, b.id).then(load)}>Подтвердить</button>}
            {b.status !== 'CANCELLED' && b.status !== 'COMPLETED' && <button style={{ ...btnGhost, padding: '5px 12px', fontSize: 13, color: 'var(--accent-red)' }} onClick={() => api.cancelBooking(b.cancelToken).then(load)}>Отменить</button>}
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-sub)', marginTop: 6 }}>
            {b.clientName} · {b.clientContact}{b.message ? ` · «${b.message}»` : ''}
          </div>
        </div>
      ))}
    </section>
  );
}

function statusLabel(s: string) { return { HELD: 'Ожидает', CONFIRMED: 'Подтверждена', CANCELLED: 'Отменена', COMPLETED: 'Завершена' }[s] ?? s; }
function statusBg(s: string) { return { HELD: '#b8860b', CONFIRMED: 'var(--accent)', CANCELLED: '#999', COMPLETED: '#4a6335' }[s] ?? '#999'; }

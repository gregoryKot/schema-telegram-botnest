import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api';
import type { AvailabilityRule, SessionOption, AdminBookingStatus } from '../../api';
import { useAsyncData } from '../../hooks/useAsyncData';
import { card, btn, input } from './shared';
import { useSaveFeedback } from './useSaveFeedback';
import { BookingsManager } from './BookingsManager';
import { ScheduleSection } from './ScheduleSection';
import { ClientBookingLink } from './ClientBookingLink';

/** Booking admin tab: integrations status, prices, schedule, bookings list. */
export function BookingSection({ adminKey }: { adminKey: string }) {
  const fetcher = useCallback(() => api.adminListRules(adminKey), [adminKey]);
  const { data: rules, reload, failed } = useAsyncData<AvailabilityRule[]>(fetcher, []);

  return (
    <>
      <IntegrationStatus adminKey={adminKey} />
      <ClientBookingLink />
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
      <h2 style={{ fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 400, letterSpacing: '-0.01em', color: 'var(--text)', marginTop: 0, marginBottom: 12 }}>Интеграции</h2>
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
      <h2 style={{ fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 400, letterSpacing: '-0.01em', color: 'var(--text)', marginTop: 0, marginBottom: 14 }}>Цены</h2>
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
      <h2 style={{ fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 400, letterSpacing: '-0.01em', color: 'var(--text)', marginTop: 0, marginBottom: 14 }}>Подписка</h2>
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

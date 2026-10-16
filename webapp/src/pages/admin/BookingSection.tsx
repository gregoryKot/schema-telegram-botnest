import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api';
import type { AvailabilityRule, SessionOption, AdminBookingStatus } from '../../api';
import { useAsyncData } from '../../hooks/useAsyncData';
import { card } from './shared';
import { PriceRow } from './PriceRow';
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
  const [draft, setDraft] = useState<Record<string, string>>({});
  const { guard, feedback } = useSaveFeedback();
  const load = useCallback(() => {
    api.adminGetPrices(adminKey).then((o) => {
      setOpts(o);
      setDraft(Object.fromEntries(o.map((x) => [x.type, String(x.price)])));
    }).catch(() => setOpts([]));
  }, [adminKey]);
  useEffect(() => { load(); }, [load]);
  const paid = opts.filter((o) => o.type !== 'INTRO_15'); // знакомство бесплатно, не редактируется
  const save = (type: string, price: number) =>
    guard(() => api.adminSetPrice(adminKey, type as 'SESSION_50', price).then(() => load()));
  return (
    <section style={card}>
      <h2 style={{ fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 400, letterSpacing: '-0.01em', color: 'var(--text)', marginTop: 0, marginBottom: 14 }}>Цены</h2>
      {paid.map((o) => ( // платная сессия — от 1 ₽: цены 0 у неё не бывает
        <PriceRow key={o.type} label={`${o.label} · ${o.durationMin} мин`} value={draft[o.type] ?? ''} min={1}
          onChange={(raw) => setDraft({ ...draft, [o.type]: raw })} onSave={(price) => save(o.type, price)} />
      ))}
      {feedback}
      <p style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 10 }}>Знакомство всегда бесплатное. Цена применяется к новым записям сразу.</p>
    </section>
  );
}

function SubPricesManager({ adminKey }: { adminKey: string }) {
  const [opts, setOpts] = useState<{ period: 'month' | 'year'; price: number }[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const { guard, feedback } = useSaveFeedback();
  const load = useCallback(() => {
    api.adminGetSubPrices(adminKey).then((o) => {
      setOpts(o);
      setDraft(Object.fromEntries(o.map((x) => [x.period, String(x.price)])));
    }).catch(() => setOpts([]));
  }, [adminKey]);
  useEffect(() => { load(); }, [load]);
  const save = (period: 'month' | 'year', price: number) =>
    guard(() => api.adminSetSubPrice(adminKey, period, price).then(() => load()));
  return (
    <section style={card}>
      <h2 style={{ fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 400, letterSpacing: '-0.01em', color: 'var(--text)', marginTop: 0, marginBottom: 14 }}>Подписка</h2>
      {opts.map((o) => (
        <PriceRow key={o.period} label={o.period === 'year' ? 'Год' : 'Месяц'} value={draft[o.period] ?? ''} min={1}
          onChange={(raw) => setDraft({ ...draft, [o.period]: raw })} onSave={(price) => save(o.period, price)} />
      ))}
      {feedback}
      <p style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 10 }}>Авто-списание раз в период. Требует подключения услуги рекуррентных платежей у Robokassa.</p>
    </section>
  );
}

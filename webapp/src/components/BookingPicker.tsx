import { useState, useEffect, useMemo } from 'react';
import { api } from '../api';
import type { BookingSlot } from '../api';

const MSK = 'Europe/Moscow';
const dayKeyFmt = new Intl.DateTimeFormat('en-CA', { timeZone: MSK, year: 'numeric', month: '2-digit', day: '2-digit' });
const dayLblFmt = new Intl.DateTimeFormat('ru-RU', { timeZone: MSK, weekday: 'short', day: 'numeric', month: 'short' });
const timeFmt   = new Intl.DateTimeFormat('ru-RU', { timeZone: MSK, hour: '2-digit', minute: '2-digit' });

const dayKey = (iso: string) => dayKeyFmt.format(new Date(iso));
const timeLabel = (iso: string) => timeFmt.format(new Date(iso));

function dayLabel(iso: string): string {
  const todayKey = dayKeyFmt.format(new Date());
  const tomorrowKey = dayKeyFmt.format(new Date(Date.now() + 86_400_000));
  const k = dayKey(iso);
  if (k === todayKey) return 'Сегодня';
  if (k === tomorrowKey) return 'Завтра';
  return dayLblFmt.format(new Date(iso));
}

const field: React.CSSProperties = {
  width: '100%', padding: '14px 16px', fontSize: 15,
  background: 'rgba(var(--fg-rgb),0.04)', border: '1.5px solid var(--line)',
  borderRadius: 12, color: 'var(--text)', outline: 'none',
  fontFamily: 'inherit', boxSizing: 'border-box',
};
const labelSt: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.1em',
  textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 8,
};

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} style={{
      padding: '9px 16px', fontSize: 14, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
      borderRadius: 100, whiteSpace: 'nowrap', transition: 'all .15s',
      background: active ? 'var(--accent)' : 'transparent',
      color: active ? '#fff' : 'var(--text-sub)',
      border: `1.5px solid ${active ? 'var(--accent)' : 'var(--line-strong)'}`,
    }}>{children}</button>
  );
}

/** Slot-based booking widget. Falls back to `fallback` when no slots are open. */
export function BookingPicker({ fallback }: { fallback?: React.ReactNode }) {
  const [slots, setSlots] = useState<BookingSlot[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [day, setDay] = useState('');
  const [slot, setSlot] = useState<BookingSlot | null>(null);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [message, setMessage] = useState('');
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error' | 'payment_fail'>('idle');
  const [cancelToken, setCancelToken] = useState('');
  const [cancelled, setCancelled] = useState(false);
  const [meetingUrl, setMeetingUrl] = useState<string | null>(null);

  // Handle ?payment=ok / ?payment=fail redirect back from Robokassa
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('payment') === 'ok') { setStatus('done'); window.history.replaceState({}, '', window.location.pathname + window.location.hash); }
    if (p.get('payment') === 'fail') { setStatus('payment_fail'); window.history.replaceState({}, '', window.location.pathname + window.location.hash); }
  }, []);

  useEffect(() => {
    api.getSlots()
      .then((s) => { setSlots(s); if (s.length) setDay(dayKey(s[0].startsAt)); })
      .catch(() => setLoadFailed(true));
  }, []);

  // Group slots by MSK day, preserving chronological order.
  const days = useMemo(() => {
    const map = new Map<string, BookingSlot[]>();
    for (const s of slots ?? []) {
      const k = dayKey(s.startsAt);
      (map.get(k) ?? map.set(k, []).get(k)!).push(s);
    }
    return map;
  }, [slots]);

  if (slots === null && !loadFailed) {
    return <p style={{ color: 'var(--text-faint)', fontSize: 15, padding: '24px 0' }}>Загружаю свободное время…</p>;
  }
  // No availability configured (or load failed): keep the request channel open.
  if (loadFailed || slots!.length === 0) {
    return <>{fallback}</>;
  }

  if (status === 'payment_fail') return (
    <div style={{ textAlign: 'center', padding: '48px 0' }}>
      <div style={{ fontSize: 56, marginBottom: 20 }}>😕</div>
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 400, color: 'var(--text)', margin: '0 0 12px' }}>Оплата не прошла</h3>
      <p style={{ color: 'var(--text-sub)', fontSize: 16, lineHeight: 1.7, margin: '0 0 20px' }}>Слот был освобождён. Попробуйте выбрать время снова или напишите напрямую.</p>
      <button type="button" onClick={() => setStatus('idle')} style={{ padding: '13px 28px', fontSize: 15, fontWeight: 700, fontFamily: 'inherit', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 12, cursor: 'pointer' }}>
        Выбрать другое время
      </button>
    </div>
  );

  if (status === 'done') return (
    <div style={{ textAlign: 'center', padding: '48px 0' }}>
      <div style={{ fontSize: 56, marginBottom: 20 }}>{cancelled ? '🗓' : '✅'}</div>
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 400, color: 'var(--text)', margin: '0 0 12px' }}>
        {cancelled ? 'Запись отменена' : 'Время забронировано'}
      </h3>
      {!cancelled && slot && (
        <p style={{ color: 'var(--text-sub)', fontSize: 16, lineHeight: 1.7, margin: '0 0 8px' }}>
          {dayLabel(slot.startsAt)}, {timeLabel(slot.startsAt)} МСК.
        </p>
      )}
      {!cancelled && meetingUrl && (
        <div style={{ margin: '14px auto 4px', maxWidth: 420, padding: '14px 16px', background: 'rgba(var(--fg-rgb),0.04)', border: '1px solid var(--line)', borderRadius: 12 }}>
          <p style={{ fontSize: 13, color: 'var(--text-faint)', margin: '0 0 6px' }}>Ваша персональная ссылка на встречу — она же для всех будущих сессий:</p>
          <a href={meetingUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', fontSize: 15, fontWeight: 600, wordBreak: 'break-all', textDecoration: 'none' }}>{meetingUrl}</a>
        </div>
      )}
      {!cancelled && !meetingUrl && (
        <p style={{ color: 'var(--text-faint)', fontSize: 14, margin: '0 0 8px' }}>Пришлю ссылку на встречу до начала сессии.</p>
      )}
      {!cancelled && cancelToken && (
        <button type="button" onClick={async () => { try { await api.cancelBooking(cancelToken); setCancelled(true); } catch { /* ignore */ } }}
          style={{ marginTop: 12, background: 'none', border: 'none', color: 'var(--text-faint)', fontSize: 13, fontFamily: 'inherit', textDecoration: 'underline', cursor: 'pointer' }}>
          Отменить запись
        </button>
      )}
    </div>
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slot || !name.trim() || !contact.trim() || !consent) return;
    setStatus('loading');
    try {
      const res = await api.bookSlot({
        startsAt: slot.startsAt, durationMin: slot.durationMin, type: 'INTRO_15',
        clientName: name.trim(), clientContact: contact.trim(), message: message.trim() || undefined,
      });
      setCancelToken(res.cancelToken);
      (window as Window & { ym?: (...a: unknown[]) => void }).ym?.(109568051, 'reachGoal', 'booking_submit');
      if (res.paymentUrl) {
        // Paid session: redirect to Robokassa payment page
        window.location.href = res.paymentUrl;
        return;
      }
      setMeetingUrl(res.meetingUrl ?? null);
      setStatus('done');
    } catch { setStatus('error'); }
  };

  const dayList = [...days.keys()];

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div>
        <label style={labelSt}>Выберите день</label>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, WebkitOverflowScrolling: 'touch' }}>
          {dayList.map((k) => (
            <Chip key={k} active={k === day} onClick={() => { setDay(k); setSlot(null); }}>
              {dayLabel(days.get(k)![0].startsAt)}
            </Chip>
          ))}
        </div>
      </div>

      <div>
        <label style={labelSt}>Время · МСК</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {(days.get(day) ?? []).map((s) => (
            <Chip key={s.startsAt} active={slot?.startsAt === s.startsAt} onClick={() => setSlot(s)}>
              {timeLabel(s.startsAt)}
            </Chip>
          ))}
        </div>
      </div>

      {slot && (
        <>
          <div className="form-grid">
            <div><label style={labelSt}>Имя *</label><input style={field} placeholder="Ваше имя" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} /></div>
            <div><label style={labelSt}>Telegram / телефон *</label><input style={field} placeholder="@username или телефон" value={contact} onChange={(e) => setContact(e.target.value)} required maxLength={100} /></div>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-faint)', lineHeight: 1.6, margin: '-6px 0 0' }}>
            Если вы уже занимались со мной — укажите, пожалуйста, тот же контакт, что и раньше. Так я узнаю вас и дам вашу постоянную ссылку на встречу: одна и та же комната для всех наших сессий, чтобы не искать новую ссылку каждый раз. 🙂
          </p>
          <div>
            <label style={labelSt}>Запрос <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(необязательно)</span></label>
            <textarea style={{ ...field, resize: 'vertical', minHeight: 84 }} placeholder="Пара слов о том, с чем хотите разобраться" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={500} />
          </div>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 3, flexShrink: 0, accentColor: 'var(--accent)', width: 16, height: 16 }} />
            <span style={{ fontSize: 13, color: 'var(--text-faint)', lineHeight: 1.6 }}>
              Я ознакомился(ась) с <a href="/privacy" target="_blank" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Политикой конфиденциальности</a> и даю согласие на обработку данных
            </span>
          </label>
          {status === 'error' && <p style={{ color: 'var(--accent-red)', fontSize: 13, margin: 0 }}>Не удалось забронировать — возможно, время только что заняли. Обновите страницу или напишите в Telegram: <a href="https://t.me/kotlarewski" style={{ color: 'inherit' }}>@kotlarewski</a></p>}
          <button type="submit" disabled={status === 'loading' || !name.trim() || !contact.trim() || !consent}
            style={{
              alignSelf: 'flex-start', padding: '15px 30px', fontSize: 15, fontWeight: 700, fontFamily: 'inherit',
              background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 12,
              cursor: 'pointer', opacity: status === 'loading' || !name.trim() || !contact.trim() || !consent ? 0.4 : 1,
              boxShadow: '0 8px 28px rgba(77,71,153,.28)',
            }}>
            {status === 'loading' ? 'Бронирую…' : `Записаться на ${dayLabel(slot.startsAt).toLowerCase()}, ${timeLabel(slot.startsAt)} →`}
          </button>
          <p style={{ fontSize: 13, color: 'var(--text-faint)', margin: 0 }}>Первая встреча 15 минут — бесплатно. Никаких обязательств.</p>
        </>
      )}
    </form>
  );
}

import { useState, useEffect, useRef } from 'react';
import { api, type BookingSlot, type SessionOption } from '../api';
import { BookingErrorNote } from './BookingErrorNote';
import { handleBookingFailure } from './bookingFailure';
import { leadSource } from '../utils/leadSource';
import { scrollIntoViewSafe } from '../../../shared/src/utils/scrollIntoView';
import { trackBookingSubmit, trackGoal, trackGoalOnce } from '../lib/metrika';
import { useClientTimeZone } from './booking/useClientTimeZone';
import { BookingSlotsSection } from './booking/BookingSlotsSection';
import { AwaitPaymentScreen, PaymentFailScreen, DoneScreen } from './booking/BookingResultScreens';
import { localDayLabel, localTimeLabel, submitTimeSuffix } from '../../../shared/src/booking/clientTimeZone';

const dayKeyFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' });
const dayKey = (iso: string) => dayKeyFmt.format(new Date(iso));

const field: React.CSSProperties = {
  width: '100%', padding: '14px 16px', fontSize: 15,
  background: 'rgba(var(--fg-rgb),0.04)', border: '1.5px solid var(--line)',
  borderRadius: 'var(--r-12)', color: 'var(--text)', outline: 'none',
  fontFamily: 'inherit', boxSizing: 'border-box',
};
const labelSt: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.1em',
  textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 8,
};

/** Slot-based booking widget. Falls back to `fallback` when no slots are open. */
export function BookingPicker({ fallback }: { fallback?: React.ReactNode }) {
  const [tz, setTz] = useClientTimeZone();
  const [slots, setSlots] = useState<BookingSlot[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [day, setDay] = useState('');
  const [slot, setSlot] = useState<BookingSlot | null>(null);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [message, setMessage] = useState('');
  const [consent, setConsent] = useState(false);
  const [returning, setReturning] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error' | 'taken' | 'not_found' | 'payment_fail' | 'await_payment'>(() => {
    // Начальный статус выводится из ?payment= на маунте (lazy-init), а не через
    // setState в эффекте (react-hooks/set-state-in-effect). Чистка URL —
    // в эффекте ниже (побочный эффект).
    const p = new URLSearchParams(window.location.search);
    if (p.get('payment') === 'ok') return 'done';
    if (p.get('payment') === 'fail') return 'payment_fail';
    return 'idle';
  });
  const [payUrl, setPayUrl] = useState<string | null>(null);
  const [cancelToken, setCancelToken] = useState('');
  const [cancelled, setCancelled] = useState(false);
  const [meetingUrl, setMeetingUrl] = useState<string | null>(null);
  const [options, setOptions] = useState<SessionOption[]>([]);
  const [sessionType, setSessionType] = useState<'INTRO_15' | 'SESSION_50'>('INTRO_15');
  const [website, setWebsite] = useState(''); // honeypot — stays empty for humans
  const formFocused = useRef(false);

  // Handle ?payment=ok / ?payment=fail redirect back from Robokassa
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('payment') === 'ok' || p.get('payment') === 'fail') {
      window.history.replaceState({}, '', window.location.pathname + window.location.hash);
    }
  }, []);

  useEffect(() => {
    api.getSlots()
      .then((s) => { setSlots(s); if (s.length) setDay(dayKey(s[0].startsAt)); })
      .catch(() => setLoadFailed(true));
    api.getBookingOptions().then(setOptions).catch(() => setLoadFailed(true)); // сбой ≠ пусто: без опций не собрать цену — та же loadFailed, что у слотов
  }, []);

  const chosen = options.find((o) => o.type === sessionType);

  // On a terminal screen (done / payment failed), scroll it into view — on mobile
  // the result renders above the submit button and was easy to miss.
  const resultRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (status === 'done' || status === 'payment_fail' || status === 'await_payment') {
      scrollIntoViewSafe(resultRef.current, { block: 'center' });
    }
  }, [status]);

  if (slots === null && !loadFailed) {
    return <p style={{ color: 'var(--text-faint)', fontSize: 15, padding: '24px 0' }}>Загружаю свободное время…</p>;
  }
  // No availability configured (or load failed): keep the request channel open.
  if (loadFailed || slots!.length === 0) {
    return <>{fallback}</>;
  }

  if (status === 'await_payment') return <AwaitPaymentScreen resultRef={resultRef} slot={slot} tz={tz} chosen={chosen} payUrl={payUrl} />;
  if (status === 'payment_fail') return <PaymentFailScreen resultRef={resultRef} onRetry={() => setStatus('idle')} />;
  if (status === 'done') return (
    <DoneScreen
      resultRef={resultRef} slot={slot} tz={tz} cancelled={cancelled} meetingUrl={meetingUrl} cancelToken={cancelToken}
      onCancel={async () => { try { await api.cancelBooking(cancelToken); setCancelled(true); } catch { /* ignore */ } }}
    />
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    trackGoalOnce('booking_submit_click');
    if (!slot || !name.trim() || !contact.trim() || !consent) {
      const missingField = !name.trim() ? 'name' : !contact.trim() ? 'contact' : !consent ? 'consent' : 'slot';
      trackGoal('booking_error', { reason: 'validation', field: missingField });
      return;
    }
    setStatus('loading');
    try {
      const res = await api.bookSlot({
        startsAt: slot.startsAt, durationMin: slot.durationMin, type: sessionType,
        clientName: name.trim(), clientContact: contact.trim(), message: message.trim() || undefined,
        returning, acceptedOffer: consent, website, source: leadSource(), clientTimeZone: tz,
      });
      setCancelToken(res.cancelToken);
      trackBookingSubmit(sessionType);
      if (res.paymentUrl) {
        // Paid session: show a "reserved, go to pay" screen first (so the client
        // always sees the booking is registered even if Robokassa fails), then
        // they tap through to payment.
        setPayUrl(res.paymentUrl);
        setStatus('await_payment');
        return;
      }
      setMeetingUrl(res.meetingUrl ?? null);
      setStatus('done');
    } catch (err) {
      trackGoal('booking_error', { reason: 'server' });
      setStatus(handleBookingFailure(err));
    }
  };

  const onFieldFocus = () => {
    if (!formFocused.current) {
      formFocused.current = true;
      trackGoalOnce('booking_form_focus');
    }
  };

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {options.length > 1 && (
        <div>
          <div style={labelSt}>Формат встречи</div>
          <div style={{ display: 'flex', gap: 'var(--space-10)', flexWrap: 'wrap' }}>
            {options.map((o) => {
              const active = o.type === sessionType;
              return (
                <button key={o.type} type="button" onClick={() => {
                  setSessionType(o.type);
                  trackGoalOnce('booking_format', { format: o.type === 'SESSION_50' ? 'session' : 'intro' });
                }} style={{
                  flex: '1 1 180px', textAlign: 'left', padding: '14px 16px', cursor: 'pointer',
                  borderRadius: 'var(--r-12)', fontFamily: 'inherit', transition: 'all .15s',
                  background: active ? 'rgba(var(--accent-rgb),0.08)' : 'transparent',
                  border: `1.5px solid ${active ? 'var(--accent)' : 'var(--line-strong)'}`,
                }}>
                  <div className="u-h15">
                    {o.label} {o.price > 0 ? `· ${o.price.toLocaleString('ru-RU')} ₽` : '· бесплатно'}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-faint)', marginTop: 2 }}>{o.note}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <BookingSlotsSection
        slots={slots!} tz={tz} onTzChange={setTz}
        day={day} onDayChange={setDay}
        slot={slot} onSlotChange={setSlot}
      />

      {slot && (
        <>
          <div className="form-grid">
            {/* ym-disable-keys: Вебвизор (визитка, см. metrika.ts shouldRecordSession)
                не пишет ввод в этих полях — имя и контакт клиента. */}
            <div><label style={labelSt} htmlFor="bp-name">Имя *</label><input id="bp-name" className="ym-disable-keys" style={field} placeholder="Ваше имя" value={name} onChange={(e) => setName(e.target.value)} onFocus={onFieldFocus} required maxLength={100} /></div>
            <div><label style={labelSt} htmlFor="bp-contact">Telegram / телефон *</label><input id="bp-contact" className="ym-disable-keys" style={field} placeholder="@username или телефон" value={contact} onChange={(e) => setContact(e.target.value)} onFocus={onFieldFocus} required maxLength={100} /></div>
          </div>
          {/* Honeypot: hidden from users, bots tend to fill it → server rejects */}
          <input type="text" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)}
            aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }} />
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-10)', cursor: 'pointer' }}>
            <input type="checkbox" checked={returning} onChange={(e) => { setReturning(e.target.checked); if (status === 'not_found') setStatus('idle'); }} style={{ marginTop: 3, flexShrink: 0, accentColor: 'var(--accent)', width: 16, height: 16 }} />
            <span style={{ fontSize: 13, color: 'var(--text-faint)', lineHeight: 1.6 }}>
              Мы уже занимались — это повторная встреча
            </span>
          </label>
          <p style={{ fontSize: 13, color: 'var(--text-faint)', lineHeight: 1.6, margin: '-8px 0 0' }}>
            {returning
              ? 'Хорошо! Укажите, пожалуйста, тот же контакт, что и в прошлый раз — я узнаю вас и открою вашу постоянную комнату для встреч. Если контакт не совпадёт, я не смогу вас найти и попрошу проверить.'
              : 'Если занимаемся впервые — я заведу для вас персональную комнату для встреч. Она будет одна и та же для всех наших будущих сессий, чтобы не искать новую ссылку каждый раз.'}
          </p>
          <div>
            <label style={labelSt} htmlFor="bp-message">Запрос <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(необязательно)</span></label>
            <textarea id="bp-message" className="ym-disable-keys" style={{ ...field, resize: 'vertical', minHeight: 84 }} placeholder="Пара слов о том, с чем хотите разобраться" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={500} />
          </div>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-10)', cursor: 'pointer' }}>
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 3, flexShrink: 0, accentColor: 'var(--accent)', width: 16, height: 16 }} />
            <span style={{ fontSize: 13, color: 'var(--text-faint)', lineHeight: 1.6 }}>
              Я принимаю условия <a href="/offer" target="_blank" className="u-link">Публичной оферты</a>{chosen && chosen.price > 0 ? ' (договора оказания услуг)' : ''} и <a href="/privacy" target="_blank" className="u-link">Политики конфиденциальности</a>, даю согласие на обработку данных
            </span>
          </label>
          {status === 'not_found' && <p style={{ color: 'var(--accent-red)', fontSize: 13, margin: 0, lineHeight: 1.6 }}>Не нашёл вас по этому контакту. Проверьте, что ввели тот же Telegram или телефон, что и в прошлый раз. Если занимаетесь впервые — снимите галочку «повторная встреча».</p>}
          {(status === 'error' || status === 'taken') && <BookingErrorNote kind={status} />}
          <button type="submit" disabled={status === 'loading' || !name.trim() || !contact.trim() || !consent}
            style={{
              alignSelf: 'flex-start', padding: '15px 30px', fontSize: 15, fontWeight: 700, fontFamily: 'inherit',
              background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--r-12)',
              cursor: 'pointer', opacity: status === 'loading' || !name.trim() || !contact.trim() || !consent ? 0.4 : 1,
              boxShadow: 'rgba(var(--accent-rgb),.28) 0 8px 28px',
            }}>
            {status === 'loading'
              ? (chosen && chosen.price > 0 ? 'Перехожу к оплате…' : 'Бронирую…')
              : chosen && chosen.price > 0
                ? `Оплатить ${chosen.price.toLocaleString('ru-RU')} ₽ и записаться →`
                : `Записаться на ${localDayLabel(slot.startsAt, tz).toLowerCase()}, ${localTimeLabel(slot.startsAt, tz)} ${submitTimeSuffix(tz, new Date(slot.startsAt))} →`}
          </button>
          {(!name.trim() || !contact.trim() || !consent) ? (
            <p style={{ fontSize: 13, color: 'var(--accent-red)', margin: 0 }}>
              Чтобы записаться, заполните: {[
                !name.trim() && 'имя',
                !contact.trim() && 'Telegram или телефон',
                !consent && 'согласие с офертой',
              ].filter(Boolean).join(', ')}.
            </p>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--text-faint)', margin: 0 }}>
              {chosen && chosen.price > 0
                ? 'Оплата картой или СБП через Robokassa. Чек придёт автоматически.'
                : 'Первая встреча 15 минут — бесплатно. Никаких обязательств.'}
            </p>
          )}
        </>
      )}
    </form>
  );
}
